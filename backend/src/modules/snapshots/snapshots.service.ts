import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { CurrentUser } from '../../types/request';
import { HoldingsService, HoldingRecord } from '../holdings/holdings.service';
import { MarketService } from '../market/market.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { PortfolioSnapshot, SnapshotHolding, SnapshotQuote } from './entities/portfolio-snapshot.entity';

export interface SnapshotRecord extends Omit<PortfolioSnapshot, 'portfolio' | 'totalValue' | 'createdAt'> {
  totalValue: number;
  createdAt: string;
}

const WEIGHT_SCALE = 4;
const VALUE_SCALE = 2;

@Injectable()
export class SnapshotsService {
  private readonly snapshots: SnapshotRecord[] = [];
  /** key: clientRequestId，首次请求结束前持有 Promise，保证并发首次只生成一张 */
  private readonly inflight = new Map<string, Promise<SnapshotRecord>>();
  private nextId = 1;

  constructor(
    private readonly portfoliosService: PortfoliosService,
    private readonly holdingsService: HoldingsService,
    private readonly marketService: MarketService,
  ) {}

  async create(portfolioId: number, dto: { clientRequestId: string }, user: CurrentUser): Promise<SnapshotRecord> {
    const key = dto.clientRequestId;

    // 已完成的请求：同键同组合回读原快照；同键换组合返回 409
    const existing = this.snapshots.find((item) => item.clientRequestId === key);
    if (existing) return this.resolveExisting(existing, portfolioId);

    // 并发中的请求：复用首次调用的结果，保证只生成一张
    const pending = this.inflight.get(key);
    if (pending) {
      return pending.then((snapshot) => this.resolveExisting(snapshot, portfolioId));
    }

    const promise = this.build(portfolioId, dto.clientRequestId, user)
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  list(portfolioId: number, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);
    return this.snapshots.filter((item) => item.portfolioId === portfolioId);
  }

  private resolveExisting(snapshot: SnapshotRecord, portfolioId: number) {
    if (snapshot.portfolioId !== portfolioId) {
      throw new ConflictException('clientRequestId already used by another portfolio');
    }
    return snapshot;
  }

  private async build(portfolioId: number, clientRequestId: string, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);

    // 先完成全部读取与校验，任何一个价格无效都会整体抛出，此时尚未写入记录
    const holdings = this.readValuedHoldings(portfolioId, user);
    if (holdings.length === 0) throw new BadRequestException('portfolio has no holdings to snapshot');

    const quotesBySymbol = new Map<string, SnapshotQuote>();
    const valued = holdings.map((holding) => {
      const price = this.validatedPrice(holding);
      const quote = this.quoteFor(holding.symbol);
      quotesBySymbol.set(quote.symbol, {
        symbol: quote.symbol,
        name: quote.name,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        updatedAt: quote.updatedAt,
      });
      return { holding, price, marketValue: Number((price * holding.quantity).toFixed(VALUE_SCALE)) };
    });

    const totalValue = Number(valued.reduce((sum, item) => sum + item.marketValue, 0).toFixed(VALUE_SCALE));
    if (totalValue <= 0) throw new BadRequestException('portfolio total market value must be positive');

    const snapshotHoldings = this.weighted(valued, totalValue);
    const quotes = Array.from(quotesBySymbol.values());

    const snapshot: SnapshotRecord = {
      id: this.nextId++,
      portfolioId,
      clientRequestId,
      totalValue,
      holdings: snapshotHoldings,
      quotes,
      createdAt: new Date().toISOString(),
    };
    // 冻结快照内容，之后持仓或行情变化都不会改写历史快照
    this.deepFreeze(snapshot);
    this.snapshots.push(snapshot);
    return snapshot;
  }

  private readValuedHoldings(portfolioId: number, user: CurrentUser): HoldingRecord[] {
    try {
      // 复制一份，冻结后源持仓的后续变动不会影响快照
      return this.holdingsService.listByPortfolio(portfolioId, user).map((item) => ({ ...item }));
    } catch (error) {
      // 行情缺失等价于当前价无效：整次拒绝
      throw new BadRequestException('invalid market price for a portfolio holding');
    }
  }

  private quoteFor(symbol: string) {
    try {
      return this.marketService.quote(symbol);
    } catch (error) {
      throw new BadRequestException(`market quote unavailable for ${symbol}`);
    }
  }

  private validatedPrice(holding: HoldingRecord) {
    const price = holding.currentPrice;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
      throw new BadRequestException(`invalid market price for holding ${holding.symbol}`);
    }
    return price;
  }

  private weighted(items: Array<{ holding: HoldingRecord; price: number; marketValue: number }>, totalValue: number) {
    // 权重保留四位小数，按最大余额法分配，末项吸收全部舍入差后合计恰为 1
    const exact = items.map((item) => (item.marketValue / totalValue) * 10 ** WEIGHT_SCALE);
    const floors = exact.map((value) => Math.floor(value));
    let remaining = 10 ** WEIGHT_SCALE - floors.reduce((sum, value) => sum + value, 0);
    const order = exact
      .map((value, index) => ({ index, fraction: value - floors[index] }))
      .sort((a, b) => b.fraction - a.fraction);
    for (const { index } of order) {
      if (remaining <= 0) break;
      floors[index] += 1;
      remaining -= 1;
    }
    return items.map((item, index) => {
      const isLast = index === items.length - 1;
      const weight = isLast
        ? Number((1 - this.sumOf(floors, index) / 10 ** WEIGHT_SCALE).toFixed(WEIGHT_SCALE))
        : Number((floors[index] / 10 ** WEIGHT_SCALE).toFixed(WEIGHT_SCALE));
      const frozen: SnapshotHolding = {
        holdingId: item.holding.id,
        symbol: item.holding.symbol,
        quantity: item.holding.quantity,
        avgCost: item.holding.avgCost,
        currentPrice: item.price,
        marketValue: item.marketValue,
        weight,
      };
      return frozen;
    });
  }

  private sumOf(values: number[], beforeIndex: number) {
    return values.slice(0, beforeIndex).reduce((sum, value) => sum + value, 0);
  }

  private deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value).forEach((child) => this.deepFreeze(child));
    }
    return value;
  }
}

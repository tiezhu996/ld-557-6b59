import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CurrentUser } from '../../types/request';
import { HoldingsService } from '../holdings/holdings.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';

export interface SnapshotItem {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  weight: number;
}

export interface SnapshotRecord {
  id: number;
  portfolioId: number;
  userId: number;
  clientRequestId: string;
  totalValue: number;
  items: SnapshotItem[];
  createdAt: string;
}

const WEIGHT_UNITS = 10000;

@Injectable()
export class SnapshotsService {
  private readonly snapshots: SnapshotRecord[] = [];
  private readonly inFlight = new Map<string, Promise<SnapshotRecord>>();
  private nextId = 1;

  constructor(
    private readonly portfoliosService: PortfoliosService,
    private readonly holdingsService: HoldingsService,
  ) {}

  list(portfolioId: number, user: CurrentUser) {
    this.portfoliosService.findOwned(portfolioId, user);
    return this.snapshots.filter((item) => item.portfolioId === portfolioId);
  }

  async create(portfolioId: number, dto: CreateSnapshotDto, user: CurrentUser): Promise<SnapshotRecord> {
    this.portfoliosService.findOwned(portfolioId, user);

    const existing = this.snapshots.find((item) => item.userId === user.id && item.clientRequestId === dto.clientRequestId);
    if (existing) {
      if (existing.portfolioId !== portfolioId) throw new ConflictException('clientRequestId already used for another portfolio');
      return existing;
    }

    const flightKey = `${user.id}:${dto.clientRequestId}`;
    const pending = this.inFlight.get(flightKey);
    if (pending) {
      const snapshot = await pending;
      if (snapshot.portfolioId !== portfolioId) throw new ConflictException('clientRequestId already used for another portfolio');
      return snapshot;
    }

    const task = this.buildSnapshot(portfolioId, dto, user);
    this.inFlight.set(flightKey, task);
    try {
      return await task;
    } finally {
      this.inFlight.delete(flightKey);
    }
  }

  private async buildSnapshot(portfolioId: number, dto: CreateSnapshotDto, user: CurrentUser): Promise<SnapshotRecord> {
    const holdings = this.holdingsService.listByPortfolio(portfolioId, user);
    if (holdings.length === 0) throw new UnprocessableEntityException('portfolio has no holdings to snapshot');

    const items: SnapshotItem[] = holdings.map((holding) => {
      const price = holding.currentPrice;
      if (!Number.isFinite(price) || price <= 0) {
        throw new UnprocessableEntityException(`invalid price for ${holding.symbol}`);
      }
      return {
        symbol: holding.symbol,
        quantity: holding.quantity,
        price,
        value: Number((price * holding.quantity).toFixed(2)),
        weight: 0,
      };
    });

    const totalValue = Number(items.reduce((sum, item) => sum + item.value, 0).toFixed(2));
    if (totalValue <= 0) throw new UnprocessableEntityException('portfolio total value must be positive');

    let assignedUnits = 0;
    items.forEach((item, index) => {
      if (index === items.length - 1) return;
      const units = Math.round((item.value / totalValue) * WEIGHT_UNITS);
      item.weight = units / WEIGHT_UNITS;
      assignedUnits += units;
    });
    items[items.length - 1].weight = (WEIGHT_UNITS - assignedUnits) / WEIGHT_UNITS;

    const snapshot: SnapshotRecord = {
      id: this.nextId++,
      portfolioId,
      userId: user.id,
      clientRequestId: dto.clientRequestId,
      totalValue,
      items,
      createdAt: new Date().toISOString(),
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }
}

import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Portfolio } from '../../portfolios/entities/portfolio.entity';

export interface SnapshotHolding {
  holdingId: number;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
}

export interface SnapshotQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

@Entity('portfolio_snapshots')
export class PortfolioSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  portfolioId: number;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  portfolio: Portfolio;

  @Index({ unique: true })
  @Column()
  clientRequestId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  totalValue: string;

  @Column({ type: 'jsonb' })
  holdings: SnapshotHolding[];

  @Column({ type: 'jsonb' })
  quotes: SnapshotQuote[];

  @CreateDateColumn()
  createdAt: Date;
}

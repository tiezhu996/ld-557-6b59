import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Portfolio } from '../../portfolios/entities/portfolio.entity';

export interface SnapshotItemRow {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  weight: number;
}

@Entity('portfolio_snapshots')
export class PortfolioSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  portfolioId: number;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  portfolio: Portfolio;

  @Column()
  userId: number;

  @Column()
  clientRequestId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalValue: string;

  @Column({ type: 'jsonb', default: [] })
  items: SnapshotItemRow[];

  @CreateDateColumn()
  createdAt: Date;
}

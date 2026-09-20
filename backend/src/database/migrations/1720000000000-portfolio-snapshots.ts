import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortfolioSnapshots1720000000000 implements MigrationInterface {
  name = 'PortfolioSnapshots1720000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE portfolio_snapshots (
        id SERIAL PRIMARY KEY,
        portfolio_id INT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
        client_request_id VARCHAR(128) NOT NULL,
        total_value DECIMAL(18,2) NOT NULL,
        holdings JSONB NOT NULL DEFAULT '[]',
        quotes JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT now()
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_portfolio_snapshots_client_request ON portfolio_snapshots (client_request_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS portfolio_snapshots CASCADE`);
  }
}

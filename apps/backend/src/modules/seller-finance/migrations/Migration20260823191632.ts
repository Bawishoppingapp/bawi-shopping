import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260823191632 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "commission_ledger_entry" add column if not exists "currency_code" text check ("currency_code" in ('usd', 'etb')) not null default 'usd';`);

    this.addSql(`alter table if exists "payout" add column if not exists "currency_code" text check ("currency_code" in ('usd', 'etb')) not null default 'usd';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "commission_ledger_entry" drop column if exists "currency_code";`);

    this.addSql(`alter table if exists "payout" drop column if exists "currency_code";`);
  }

}

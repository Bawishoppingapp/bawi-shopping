import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260826020449 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "commission_ledger_entry" alter column "currency_code" type text using ("currency_code"::text);`);
    this.addSql(`alter table if exists "commission_ledger_entry" alter column "currency_code" set default 'etb';`);

    this.addSql(`alter table if exists "payout" alter column "currency_code" type text using ("currency_code"::text);`);
    this.addSql(`alter table if exists "payout" alter column "currency_code" set default 'etb';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "commission_ledger_entry" alter column "currency_code" type text using ("currency_code"::text);`);
    this.addSql(`alter table if exists "commission_ledger_entry" alter column "currency_code" set default 'usd';`);

    this.addSql(`alter table if exists "payout" alter column "currency_code" type text using ("currency_code"::text);`);
    this.addSql(`alter table if exists "payout" alter column "currency_code" set default 'usd';`);
  }

}

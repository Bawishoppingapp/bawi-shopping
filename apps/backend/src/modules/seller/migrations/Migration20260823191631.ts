import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260823191631 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" add column if not exists "currency_code" text check ("currency_code" in ('usd', 'etb')) not null default 'usd';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop column if exists "currency_code";`);
  }

}

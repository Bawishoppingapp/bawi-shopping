import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260826020450 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketplace_order" alter column "currency_code" type text using ("currency_code"::text);`);
    this.addSql(`alter table if exists "marketplace_order" alter column "currency_code" set default 'etb';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "marketplace_order" alter column "currency_code" type text using ("currency_code"::text);`);
    this.addSql(`alter table if exists "marketplace_order" alter column "currency_code" set default 'usd';`);
  }

}

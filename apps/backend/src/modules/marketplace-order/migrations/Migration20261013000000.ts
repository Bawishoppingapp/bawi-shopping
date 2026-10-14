import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261013000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketplace_order" drop constraint if exists "marketplace_order_status_check";`)
    this.addSql(`alter table if exists "marketplace_order" add constraint "marketplace_order_status_check" check ("status" in ('pending_quote','pending_payment','paid','payment_failed','cancelled'));`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "marketplace_order" drop constraint if exists "marketplace_order_status_check";`)
    this.addSql(`alter table if exists "marketplace_order" add constraint "marketplace_order_status_check" check ("status" in ('pending_payment','paid','payment_failed','cancelled'));`)
  }
}

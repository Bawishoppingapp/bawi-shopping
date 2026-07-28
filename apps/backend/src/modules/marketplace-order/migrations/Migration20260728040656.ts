import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728040656 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "vendor_order" add column if not exists "assigned_courier_id" text null, add column if not exists "preparing_at" timestamptz null, add column if not exists "ready_for_pickup_at" timestamptz null, add column if not exists "picked_up_at" timestamptz null, add column if not exists "out_for_delivery_at" timestamptz null, add column if not exists "delivered_at" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "vendor_order" drop column if exists "assigned_courier_id", drop column if exists "preparing_at", drop column if exists "ready_for_pickup_at", drop column if exists "picked_up_at", drop column if exists "out_for_delivery_at", drop column if exists "delivered_at";`);
  }

}

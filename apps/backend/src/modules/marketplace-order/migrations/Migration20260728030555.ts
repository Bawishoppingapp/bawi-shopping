import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728030555 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "vendor_order" drop constraint if exists "vendor_order_fulfillment_code_unique";`);
    this.addSql(`alter table if exists "marketplace_order" drop constraint if exists "marketplace_order_stripe_payment_intent_id_unique";`);
    this.addSql(`alter table if exists "marketplace_order" drop constraint if exists "marketplace_order_idempotency_key_unique";`);
    this.addSql(`alter table if exists "marketplace_order" drop constraint if exists "marketplace_order_display_id_unique";`);
    this.addSql(`create table if not exists "marketplace_order" ("id" text not null, "display_id" text not null, "customer_id" text not null, "currency_code" text not null default 'usd', "status" text check ("status" in ('pending_payment', 'paid', 'payment_failed', 'cancelled')) not null default 'pending_payment', "idempotency_key" text not null, "subtotal_amount" integer not null, "shipping_amount" integer not null, "tax_amount" integer not null, "tax_rate_basis_points" integer not null, "total_amount" integer not null, "shipping_address" jsonb not null, "line_items_snapshot" jsonb not null, "reservation_item_ids" jsonb null, "stripe_payment_intent_id" text null, "payment_status" text check ("payment_status" in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')) not null default 'pending', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "marketplace_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_order_display_id_unique" ON "marketplace_order" ("display_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_order_idempotency_key_unique" ON "marketplace_order" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_order_stripe_payment_intent_id_unique" ON "marketplace_order" ("stripe_payment_intent_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_marketplace_order_deleted_at" ON "marketplace_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "vendor_order" ("id" text not null, "vendor_id" text not null, "status" text check ("status" in ('awaiting_preparation', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'returned')) not null default 'awaiting_preparation', "subtotal_amount" integer not null, "shipping_amount" integer not null, "tax_amount" integer not null, "commission_rate_basis_points" integer not null, "commission_amount" integer not null, "total_amount" integer not null, "fulfillment_code" text not null, "fulfillment_deadline_at" timestamptz not null, "order_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendor_order_fulfillment_code_unique" ON "vendor_order" ("fulfillment_code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_order_order_id" ON "vendor_order" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_order_deleted_at" ON "vendor_order" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "vendor_order_item" ("id" text not null, "vendor_id" text not null, "variant_id" text null, "product_id" text null, "product_code" text null, "title" text not null, "thumbnail" text null, "color" text null, "size" text null, "unit_price_amount" integer not null, "quantity" integer not null, "line_total_amount" integer not null, "vendor_order_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_order_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_order_item_vendor_order_id" ON "vendor_order_item" ("vendor_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_order_item_deleted_at" ON "vendor_order_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "vendor_order" add constraint "vendor_order_order_id_foreign" foreign key ("order_id") references "marketplace_order" ("id") on update cascade;`);

    this.addSql(`alter table if exists "vendor_order_item" add constraint "vendor_order_item_vendor_order_id_foreign" foreign key ("vendor_order_id") references "vendor_order" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "vendor_order" drop constraint if exists "vendor_order_order_id_foreign";`);

    this.addSql(`alter table if exists "vendor_order_item" drop constraint if exists "vendor_order_item_vendor_order_id_foreign";`);

    this.addSql(`drop table if exists "marketplace_order" cascade;`);

    this.addSql(`drop table if exists "vendor_order" cascade;`);

    this.addSql(`drop table if exists "vendor_order_item" cascade;`);
  }

}

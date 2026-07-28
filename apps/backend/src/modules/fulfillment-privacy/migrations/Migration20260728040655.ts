import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728040655 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "tracking_code" drop constraint if exists "tracking_code_code_unique";`);
    this.addSql(`alter table if exists "tracking_code" drop constraint if exists "tracking_code_vendor_order_id_unique";`);
    this.addSql(`alter table if exists "pickup_code" drop constraint if exists "pickup_code_code_unique";`);
    this.addSql(`alter table if exists "pickup_code" drop constraint if exists "pickup_code_vendor_order_id_unique";`);
    this.addSql(`alter table if exists "fulfillment_code_redemption" drop constraint if exists "fulfillment_code_redemption_code_id_unique";`);
    this.addSql(`alter table if exists "courier" drop constraint if exists "courier_activation_token_unique";`);
    this.addSql(`alter table if exists "courier" drop constraint if exists "courier_email_unique";`);
    this.addSql(`create table if not exists "courier" ("id" text not null, "name" text not null, "email" text not null, "phone" text null, "auth_identity_id" text null, "activation_token" text null, "activation_token_expires_at" timestamptz null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "courier_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_courier_email_unique" ON "courier" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_courier_activation_token_unique" ON "courier" ("activation_token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_courier_deleted_at" ON "courier" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "fulfillment_code_redemption" ("id" text not null, "code_type" text check ("code_type" in ('pickup', 'tracking')) not null, "code_id" text not null, "courier_id" text not null, "redeemed_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fulfillment_code_redemption_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fulfillment_code_redemption_code_id_unique" ON "fulfillment_code_redemption" ("code_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fulfillment_code_redemption_deleted_at" ON "fulfillment_code_redemption" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pickup_code" ("id" text not null, "vendor_order_id" text not null, "code" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pickup_code_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pickup_code_vendor_order_id_unique" ON "pickup_code" ("vendor_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pickup_code_code_unique" ON "pickup_code" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pickup_code_deleted_at" ON "pickup_code" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "tracking_code" ("id" text not null, "vendor_order_id" text not null, "code" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tracking_code_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tracking_code_vendor_order_id_unique" ON "tracking_code" ("vendor_order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tracking_code_code_unique" ON "tracking_code" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_tracking_code_deleted_at" ON "tracking_code" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "courier" cascade;`);

    this.addSql(`drop table if exists "fulfillment_code_redemption" cascade;`);

    this.addSql(`drop table if exists "pickup_code" cascade;`);

    this.addSql(`drop table if exists "tracking_code" cascade;`);
  }

}

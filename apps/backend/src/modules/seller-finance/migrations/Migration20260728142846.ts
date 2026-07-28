import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728142846 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "payout_line_item" drop constraint if exists "payout_line_item_commission_ledger_entry_id_unique";`);
    this.addSql(`alter table if exists "payout" drop constraint if exists "payout_stripe_transfer_id_unique";`);
    this.addSql(`alter table if exists "payout" drop constraint if exists "payout_idempotency_key_unique";`);
    this.addSql(`alter table if exists "order_refund" drop constraint if exists "order_refund_stripe_refund_id_unique";`);
    this.addSql(`alter table if exists "order_refund" drop constraint if exists "order_refund_return_request_id_unique";`);
    this.addSql(`alter table if exists "dispute" drop constraint if exists "dispute_stripe_dispute_id_unique";`);
    this.addSql(`create table if not exists "commission_ledger_entry" ("id" text not null, "vendor_order_id" text not null, "vendor_id" text not null, "reason" text check ("reason" in ('order', 'refund_reversal')) not null, "commission_rate_basis_points" integer not null, "commission_amount" integer not null, "net_amount" integer not null, "transfer_hold_days_snapshot" integer not null, "available_at" timestamptz null, "paid_at" timestamptz null, "disputed_at" timestamptz null, "dispute_resolved_at" timestamptz null, "reverses_entry_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "commission_ledger_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_commission_ledger_entry_deleted_at" ON "commission_ledger_entry" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "dispute" ("id" text not null, "order_id" text not null, "vendor_order_id" text null, "stripe_dispute_id" text not null, "amount" integer not null, "reason" text null, "status" text check ("status" in ('open', 'won', 'lost')) not null default 'open', "resolved_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "dispute_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dispute_stripe_dispute_id_unique" ON "dispute" ("stripe_dispute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_dispute_deleted_at" ON "dispute" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "order_refund" ("id" text not null, "return_request_id" text not null, "order_id" text not null, "vendor_order_id" text not null, "amount" integer not null, "is_partial" boolean not null, "stripe_refund_id" text null, "status" text check ("status" in ('pending', 'succeeded', 'failed')) not null default 'pending', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_refund_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_refund_return_request_id_unique" ON "order_refund" ("return_request_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_refund_stripe_refund_id_unique" ON "order_refund" ("stripe_refund_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_order_refund_deleted_at" ON "order_refund" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "payout" ("id" text not null, "vendor_id" text not null, "idempotency_key" text not null, "amount" integer not null, "status" text check ("status" in ('pending', 'paid', 'failed')) not null default 'pending', "stripe_transfer_id" text null, "reconciled_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payout_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payout_idempotency_key_unique" ON "payout" ("idempotency_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payout_stripe_transfer_id_unique" ON "payout" ("stripe_transfer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_deleted_at" ON "payout" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "payout_line_item" ("id" text not null, "commission_ledger_entry_id" text not null, "amount" integer not null, "payout_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payout_line_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payout_line_item_commission_ledger_entry_id_unique" ON "payout_line_item" ("commission_ledger_entry_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_line_item_payout_id" ON "payout_line_item" ("payout_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payout_line_item_deleted_at" ON "payout_line_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "return_request" ("id" text not null, "vendor_order_item_id" text not null, "vendor_order_id" text not null, "vendor_id" text not null, "order_id" text not null, "customer_id" text not null, "reason" text check ("reason" in ('damaged', 'defective', 'incorrect', 'customer_remorse')) not null, "customer_comment" text null, "status" text check ("status" in ('requested', 'approved', 'denied', 'refunded')) not null default 'requested', "seller_response" text null, "reviewed_by" text null, "reviewed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "return_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_return_request_deleted_at" ON "return_request" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "payout_line_item" add constraint "payout_line_item_payout_id_foreign" foreign key ("payout_id") references "payout" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "payout_line_item" drop constraint if exists "payout_line_item_payout_id_foreign";`);

    this.addSql(`drop table if exists "commission_ledger_entry" cascade;`);

    this.addSql(`drop table if exists "dispute" cascade;`);

    this.addSql(`drop table if exists "order_refund" cascade;`);

    this.addSql(`drop table if exists "payout" cascade;`);

    this.addSql(`drop table if exists "payout_line_item" cascade;`);

    this.addSql(`drop table if exists "return_request" cascade;`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260903090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_method" text not null default 'manual_telebirr';`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_reference" text null;`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_proof_url" text null;`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_recipient_name" text null;`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_recipient_phone" text null;`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_submitted_at" timestamptz null;`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_reviewed_by" text null;`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_reviewed_at" timestamptz null;`)
    this.addSql(`alter table if exists "marketplace_order" add column if not exists "payment_rejection_reason" text null;`)
    this.addSql(`alter table if exists "marketplace_order" drop constraint if exists "marketplace_order_payment_status_check";`)
    this.addSql(`alter table if exists "marketplace_order" add constraint "marketplace_order_payment_status_check" check ("payment_status" in ('pending','requires_action','proof_submitted','under_review','succeeded','rejected','failed','canceled'));`)
    this.addSql(`create unique index if not exists "IDX_marketplace_order_payment_reference_unique" on "marketplace_order" ("payment_reference") where deleted_at is null and payment_reference is not null;`)
    this.addSql(`create index if not exists "IDX_marketplace_order_payment_status" on "marketplace_order" ("payment_status") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_marketplace_order_payment_status";`)
    this.addSql(`drop index if exists "IDX_marketplace_order_payment_reference_unique";`)
    this.addSql(`alter table if exists "marketplace_order" drop constraint if exists "marketplace_order_payment_status_check";`)
    this.addSql(`alter table if exists "marketplace_order" add constraint "marketplace_order_payment_status_check" check ("payment_status" in ('pending','requires_action','succeeded','failed','canceled'));`)
    this.addSql(`alter table if exists "marketplace_order" drop column if exists "payment_rejection_reason", drop column if exists "payment_reviewed_at", drop column if exists "payment_reviewed_by", drop column if exists "payment_submitted_at", drop column if exists "payment_recipient_phone", drop column if exists "payment_recipient_name", drop column if exists "payment_proof_url", drop column if exists "payment_reference", drop column if exists "payment_method";`)
  }
}

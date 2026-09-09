import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260903090100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_listing" add column if not exists "ai_preview_status" text not null default 'not_requested' check ("ai_preview_status" in ('not_requested','ready_for_generation','generated','approved','rejected'));`)
    this.addSql(`alter table if exists "product_listing" add column if not exists "ai_preview_url" text null, add column if not exists "ai_preview_generated_by" text null, add column if not exists "ai_preview_generated_at" timestamptz null, add column if not exists "ai_preview_reviewed_by" text null, add column if not exists "ai_preview_reviewed_at" timestamptz null, add column if not exists "ai_preview_rejection_reason" text null;`)
    this.addSql(`create index if not exists "IDX_product_listing_ai_preview_status" on "product_listing" ("ai_preview_status") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_product_listing_ai_preview_status";`)
    this.addSql(`alter table if exists "product_listing" drop column if exists "ai_preview_rejection_reason", drop column if exists "ai_preview_reviewed_at", drop column if exists "ai_preview_reviewed_by", drop column if exists "ai_preview_generated_at", drop column if exists "ai_preview_generated_by", drop column if exists "ai_preview_url", drop column if exists "ai_preview_status";`)
  }
}

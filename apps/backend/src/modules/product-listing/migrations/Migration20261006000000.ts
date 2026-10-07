import { Migration } from "@medusajs/framework/mikro-orm/migrations"
export class Migration20261006000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "product_listing" add column if not exists "ai_image_workflow" jsonb null, add column if not exists "ai_image_pending" boolean not null default false;`)
    this.addSql(`create index if not exists "IDX_product_listing_ai_pending" on "product_listing" ("updated_at") where ai_image_pending = true and deleted_at is null;`)
  }
  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_product_listing_ai_pending";`)
    this.addSql(`alter table "product_listing" drop column if exists "ai_image_workflow", drop column if exists "ai_image_pending";`)
  }
}

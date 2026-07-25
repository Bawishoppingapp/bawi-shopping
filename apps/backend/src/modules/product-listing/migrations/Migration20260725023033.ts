import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260725023033 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_listing" drop constraint if exists "product_listing_product_code_unique";`);
    this.addSql(`alter table if exists "product_listing" drop constraint if exists "product_listing_product_id_unique";`);
    this.addSql(`create table if not exists "product_listing" ("id" text not null, "product_id" text not null, "vendor_id" text not null, "product_code" text not null, "status" text check ("status" in ('draft', 'pending_review', 'approved', 'rejected', 'archived')) not null default 'draft', "rejection_reason" text null, "submitted_at" timestamptz null, "reviewed_by" text null, "reviewed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_listing_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_listing_product_id_unique" ON "product_listing" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_listing_product_code_unique" ON "product_listing" ("product_code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_listing_deleted_at" ON "product_listing" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_listing_vendor_id" ON "product_listing" ("vendor_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_listing_status" ON "product_listing" ("status") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_listing" cascade;`);
  }

}

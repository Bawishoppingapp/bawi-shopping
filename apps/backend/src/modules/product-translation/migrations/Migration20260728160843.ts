import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728160843 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_translation" ("id" text not null, "product_id" text not null, "vendor_id" text not null, "locale" text check ("locale" in ('am', 'ti', 'om', 'zh-CN', 'es')) not null, "title" text not null, "description" text null, "status" text check ("status" in ('draft', 'pending_review', 'approved', 'rejected')) not null default 'draft', "rejection_reason" text null, "submitted_at" timestamptz null, "reviewed_by" text null, "reviewed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_translation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_translation_deleted_at" ON "product_translation" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_translation" cascade;`);
  }

}

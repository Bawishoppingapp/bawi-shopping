import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260724211036 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "seller_application" ("id" text not null, "legal_business_name" text not null, "store_name" text not null, "business_type" text check ("business_type" in ('sole_proprietorship', 'llc', 'corporation', 'partnership', 'other')) not null, "business_description" text not null, "estimated_product_count" integer not null, "product_categories" jsonb not null, "address" jsonb not null, "contact_first_name" text not null, "contact_last_name" text not null, "business_email" text not null, "phone_number" text not null, "website_url" text null, "agreed_to_terms" boolean not null, "submitted_at" timestamptz not null, "status" text check ("status" in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn')) not null default 'submitted', "rejection_reason" text null, "reviewed_by" text null, "reviewed_at" timestamptz null, "seller_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_application_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_application_deleted_at" ON "seller_application" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seller_application" cascade;`);
  }

}

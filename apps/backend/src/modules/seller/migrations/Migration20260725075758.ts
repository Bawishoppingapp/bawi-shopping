import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260725075758 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop constraint if exists "seller_stripe_account_id_unique";`);
    this.addSql(`alter table if exists "seller" add column if not exists "stripe_account_id" text null, add column if not exists "stripe_charges_enabled" boolean not null default false, add column if not exists "stripe_payouts_enabled" boolean not null default false, add column if not exists "stripe_details_submitted" boolean not null default false, add column if not exists "public_brand_display_approved" boolean not null default false;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seller_stripe_account_id_unique" ON "seller" ("stripe_account_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_seller_stripe_account_id_unique";`);
    this.addSql(`alter table if exists "seller" drop column if exists "stripe_account_id", drop column if exists "stripe_charges_enabled", drop column if exists "stripe_payouts_enabled", drop column if exists "stripe_details_submitted", drop column if exists "public_brand_display_approved";`);
  }

}

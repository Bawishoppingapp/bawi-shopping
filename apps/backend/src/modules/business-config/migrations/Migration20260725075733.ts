import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260725075733 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "business_config_entry" ("id" text not null, "category" text check ("category" in ('commission', 'transfer_timing', 'returns', 'shipping', 'preparation', 'cancellation', 'service_area', 'brand_visibility', 'payment_methods', 'tax', 'courier', 'email', 'sms', 'support', 'feature_flag')) not null, "key" text not null, "value" jsonb not null, "value_type" text check ("value_type" in ('integer', 'boolean', 'string', 'json')) not null, "label" text not null, "description" text null, "is_placeholder" boolean not null default false, "is_sensitive" boolean not null default false, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "business_config_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_business_config_entry_deleted_at" ON "business_config_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_business_config_entry_category_key_unique" ON "business_config_entry" ("category", "key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "business_config_entry" cascade;`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260725075749 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "processed_webhook_event" ("id" text not null, "provider" text not null, "event_id" text not null, "event_type" text not null, "processed_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "processed_webhook_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_processed_webhook_event_deleted_at" ON "processed_webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_processed_webhook_event_provider_event_id_unique" ON "processed_webhook_event" ("provider", "event_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "processed_webhook_event" cascade;`);
  }

}

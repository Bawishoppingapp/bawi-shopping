import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728154039 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "notification_inbox_entry" drop constraint if exists "notification_inbox_entry_notification_id_unique";`);
    this.addSql(`create table if not exists "notification_inbox_entry" ("id" text not null, "notification_id" text not null, "event_type" text not null, "recipient_type" text check ("recipient_type" in ('customer', 'seller_user', 'user')) not null, "recipient_id" text not null, "vendor_id" text null, "subject" text not null, "body" text not null, "read_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "notification_inbox_entry_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_inbox_entry_notification_id_unique" ON "notification_inbox_entry" ("notification_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_notification_inbox_entry_deleted_at" ON "notification_inbox_entry" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "notification_inbox_entry" cascade;`);
  }

}

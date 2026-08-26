import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260826023928 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "device_push_token" drop constraint if exists "device_push_token_expo_push_token_unique";`);
    this.addSql(`create table if not exists "device_push_token" ("id" text not null, "recipient_type" text check ("recipient_type" in ('customer', 'seller_user')) not null, "recipient_id" text not null, "expo_push_token" text not null, "platform" text check ("platform" in ('ios', 'android')) null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "device_push_token_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_device_push_token_expo_push_token_unique" ON "device_push_token" ("expo_push_token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_device_push_token_deleted_at" ON "device_push_token" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "device_push_token" cascade;`);
  }

}

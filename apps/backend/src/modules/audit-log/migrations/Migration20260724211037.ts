import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260724211037 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "audit_log" ("id" text not null, "actor_type" text check ("actor_type" in ('customer', 'seller_user', 'user', 'system')) not null, "actor_id" text null, "action" text not null, "entity_type" text not null, "entity_id" text not null, "vendor_id" text null, "before_state" jsonb null, "after_state" jsonb null, "ip_address" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "audit_log_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_deleted_at" ON "audit_log" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "audit_log" cascade;`);
  }

}

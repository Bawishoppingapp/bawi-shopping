import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260725213637 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cart_merge_claim" drop constraint if exists "cart_merge_claim_guest_cart_id_unique";`);
    this.addSql(`create table if not exists "cart_merge_claim" ("id" text not null, "guest_cart_id" text not null, "customer_id" text not null, "claimed_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cart_merge_claim_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_merge_claim_guest_cart_id_unique" ON "cart_merge_claim" ("guest_cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cart_merge_claim_deleted_at" ON "cart_merge_claim" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cart_merge_claim" cascade;`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260723051641 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller" drop constraint if exists "seller_slug_unique";`);
    this.addSql(`create table if not exists "seller" ("id" text not null, "name" text not null, "slug" text not null, "status" text check ("status" in ('pending', 'approved', 'suspended', 'rejected')) not null default 'pending', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seller_slug_unique" ON "seller" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_deleted_at" ON "seller" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "seller_user" ("id" text not null, "auth_identity_id" text not null, "role" text check ("role" in ('owner', 'catalog_manager', 'order_fulfiller', 'analyst')) not null default 'owner', "seller_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seller_user_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_user_seller_id" ON "seller_user" ("seller_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_seller_user_deleted_at" ON "seller_user" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "seller_user" add constraint "seller_user_seller_id_foreign" foreign key ("seller_id") references "seller" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "seller_user" drop constraint if exists "seller_user_seller_id_foreign";`);

    this.addSql(`drop table if exists "seller" cascade;`);

    this.addSql(`drop table if exists "seller_user" cascade;`);
  }

}

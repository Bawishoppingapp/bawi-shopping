import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260724211033 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "seller_user" drop constraint if exists "seller_user_activation_token_unique";`);
    this.addSql(`alter table if exists "seller_user" add column if not exists "email" text not null, add column if not exists "activation_token" text null, add column if not exists "activation_token_expires_at" timestamptz null;`);
    this.addSql(`alter table if exists "seller_user" alter column "auth_identity_id" type text using ("auth_identity_id"::text);`);
    this.addSql(`alter table if exists "seller_user" alter column "auth_identity_id" drop not null;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seller_user_activation_token_unique" ON "seller_user" ("activation_token") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_seller_user_activation_token_unique";`);
    this.addSql(`alter table if exists "seller_user" drop column if exists "email", drop column if exists "activation_token", drop column if exists "activation_token_expires_at";`);

    this.addSql(`alter table if exists "seller_user" alter column "auth_identity_id" type text using ("auth_identity_id"::text);`);
    this.addSql(`alter table if exists "seller_user" alter column "auth_identity_id" set not null;`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728143604 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "order_refund" alter column "return_request_id" type text using ("return_request_id"::text);`);
    this.addSql(`alter table if exists "order_refund" alter column "return_request_id" drop not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "order_refund" alter column "return_request_id" type text using ("return_request_id"::text);`);
    this.addSql(`alter table if exists "order_refund" alter column "return_request_id" set not null;`);
  }

}

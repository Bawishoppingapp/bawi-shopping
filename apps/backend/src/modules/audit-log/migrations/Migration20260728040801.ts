import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260728040801 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "audit_log" drop constraint if exists "audit_log_actor_type_check";`);

    this.addSql(`alter table if exists "audit_log" add constraint "audit_log_actor_type_check" check("actor_type" in ('customer', 'seller_user', 'user', 'system', 'courier'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "audit_log" drop constraint if exists "audit_log_actor_type_check";`);

    this.addSql(`alter table if exists "audit_log" add constraint "audit_log_actor_type_check" check("actor_type" in ('customer', 'seller_user', 'user', 'system'));`);
  }

}

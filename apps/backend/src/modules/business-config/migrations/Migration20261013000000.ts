import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261013000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`update "business_config_entry" set "value" = '"Ethiopia nationwide; Addis Ababa and neighboring cities have fixed fees, other destinations require a courier quote before payment"'::jsonb, "updated_at" = now() where "category" = 'service_area' and "key" = 'initial_service_area' and "value" = '"Addis Ababa; Burayu; Sebeta; Sululta; Legetafo/Legedadi; Bishoftu"'::jsonb;`)
  }

  override async down(): Promise<void> {
    // Do not revert an approved service-area decision or later admin changes.
  }
}

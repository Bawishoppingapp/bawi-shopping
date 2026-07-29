import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260729073524 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "business_config_entry" drop constraint if exists "business_config_entry_category_check";`);

    this.addSql(`alter table if exists "business_config_entry" add constraint "business_config_entry_category_check" check("category" in ('commission', 'transfer_timing', 'returns', 'shipping', 'preparation', 'cancellation', 'service_area', 'brand_visibility', 'payment_methods', 'tax', 'courier', 'email', 'sms', 'support', 'cart', 'feature_flag', 'legal'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "business_config_entry" drop constraint if exists "business_config_entry_category_check";`);

    this.addSql(`alter table if exists "business_config_entry" add constraint "business_config_entry_category_check" check("category" in ('commission', 'transfer_timing', 'returns', 'shipping', 'preparation', 'cancellation', 'service_area', 'brand_visibility', 'payment_methods', 'tax', 'courier', 'email', 'sms', 'support', 'cart', 'feature_flag'));`);
  }

}

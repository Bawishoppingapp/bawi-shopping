import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260903000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      update "business_config_entry"
      set "value" = '0'::jsonb,
          "description" = 'Returns are disabled for the initial launch. A future policy change must explicitly set a positive window.',
          "is_placeholder" = false,
          "updated_at" = now()
      where "category" = 'returns'
        and "key" = 'return_window_days'
        and "is_placeholder" = true;
    `)
    this.addSql(`
      update "business_config_entry" set "value" = '1000'::jsonb, "is_placeholder" = false, "updated_at" = now()
      where "category" = 'commission' and "key" = 'platform_default_rate_basis_points' and "is_placeholder" = true;
    `)
    this.addSql(`
      update "business_config_entry" set "value" = '15000'::jsonb, "is_placeholder" = false, "updated_at" = now()
      where "category" = 'shipping' and "key" = 'standard_shipping_fee_cents_etb' and "is_placeholder" = true;
    `)
    this.addSql(`
      insert into "business_config_entry" ("id", "category", "key", "value", "value_type", "label", "description", "is_placeholder", "is_sensitive", "created_at", "updated_at")
      select 'bce_neighboring_shipping_etb', 'shipping', 'neighboring_shipping_fee_cents_etb', '25000'::jsonb, 'integer', 'Neighboring Addis Ababa delivery fee, ETB cents', 'ETB 250 for supported neighboring areas.', false, false, now(), now()
      where not exists (select 1 from "business_config_entry" where "category" = 'shipping' and "key" = 'neighboring_shipping_fee_cents_etb');
    `)
    this.addSql(`
      update "business_config_entry" set "value" = '"picked_up"'::jsonb, "is_placeholder" = false, "updated_at" = now()
      where "category" = 'cancellation' and "key" = 'cancellation_cutoff' and "is_placeholder" = true;
    `)
    this.addSql(`
      update "business_config_entry" set "value" = '"Addis Ababa; Burayu; Sebeta; Sululta; Legetafo/Legedadi; Bishoftu"'::jsonb, "is_placeholder" = false, "updated_at" = now()
      where "category" = 'service_area' and "key" = 'initial_service_area' and "is_placeholder" = true;
    `)
    this.addSql(`
      update "business_config_entry" set "value" = '0'::jsonb, "is_placeholder" = false, "updated_at" = now()
      where "category" = 'tax' and "key" = 'mock_rate_basis_points' and "is_placeholder" = true;
    `)
    this.addSql(`
      update "business_config_entry" set "value" = '"Bawi Shopping"'::jsonb, "is_placeholder" = false, "updated_at" = now()
      where "category" = 'payment_methods' and "key" = 'telebirr_recipient_name' and "is_placeholder" = true;
    `)
    this.addSql(`
      update "business_config_entry"
      set "value" = '"support@bawishopping.com"'::jsonb,
          "is_placeholder" = false,
          "updated_at" = now()
      where "category" = 'support'
        and "key" = 'support_email'
        and "is_placeholder" = true;
    `)
  }

  async down(): Promise<void> {
    // These rows represent approved business decisions. Do not restore
    // placeholder launch data during a rollback.
  }
}

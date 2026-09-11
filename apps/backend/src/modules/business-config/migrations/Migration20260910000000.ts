import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260910000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      update "business_config_entry"
      set "value" = '"Bantalem Yirga"'::jsonb,
          "description" = 'Verified Telebirr recipient name shown to customers during checkout.',
          "is_placeholder" = false,
          "updated_at" = now()
      where "category" = 'payment_methods' and "key" = 'telebirr_recipient_name';
    `)
    this.addSql(`
      update "business_config_entry"
      set "value" = '"+251911385693"'::jsonb,
          "description" = 'Verified Telebirr transfer number shown to customers during checkout.',
          "is_placeholder" = false,
          "updated_at" = now()
      where "category" = 'payment_methods' and "key" = 'telebirr_recipient_phone';
    `)
  }

  async down(): Promise<void> {
    // Approved payment instructions must never be restored to placeholders.
  }
}

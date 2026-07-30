provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "bawi-shopping"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "bawi-shopping-${var.environment}"
  azs         = slice(data.aws_availability_zones.available.names, 0, var.availability_zone_count)

  # Subdomain scheme matches the example already used throughout
  # docs/DEPLOYMENT.md.
  storefront_domain    = "shop.${var.domain_name}"
  seller_portal_domain = "sell.${var.domain_name}"
  admin_domain         = "admin.${var.domain_name}"
  backend_domain       = "api.${var.domain_name}"
}

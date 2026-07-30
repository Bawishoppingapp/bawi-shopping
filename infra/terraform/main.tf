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

  # ALB/target-group resource names are capped by AWS at 32 characters -
  # local.name_prefix alone (25 chars for "production") already left only
  # 7 characters of headroom, and two of the four target group names
  # (storefront, seller-portal) exceeded the limit outright - a real bug
  # `terraform validate` cannot catch, since it's an AWS-side constraint
  # enforced at apply time, not an HCL type/syntax rule. Found via a
  # manual length audit, not surfaced by any Terraform tooling. A short,
  # length-safe prefix avoids this regardless of how long `environment`
  # is ever set to (always <= 9 characters: "bawi-" + up to 4 chars).
  alb_prefix = "bawi-${substr(var.environment, 0, 4)}"

  azs = slice(data.aws_availability_zones.available.names, 0, var.availability_zone_count)

  # Subdomain scheme matches the example already used throughout
  # docs/DEPLOYMENT.md.
  storefront_domain    = "shop.${var.domain_name}"
  seller_portal_domain = "sell.${var.domain_name}"
  admin_domain         = "admin.${var.domain_name}"
  backend_domain       = "api.${var.domain_name}"

  # Falls back to the ECR repo this module itself creates (ecr.tf) when
  # the corresponding variable is left null - see variables.tf's comment.
  # This is what removes the "manually copy an image URI into tfvars"
  # step for the common case of using the ECR repos created here.
  backend_image       = coalesce(var.backend_image, "${aws_ecr_repository.backend.repository_url}:latest")
  storefront_image    = coalesce(var.storefront_image, "${aws_ecr_repository.storefront.repository_url}:latest")
  seller_portal_image = coalesce(var.seller_portal_image, "${aws_ecr_repository.seller_portal.repository_url}:latest")
  admin_image         = coalesce(var.admin_image, "${aws_ecr_repository.admin.repository_url}:latest")
}

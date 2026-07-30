# One private ECR repository per app. Created here so `terraform apply`
# gives you a real place to push images to, rather than requiring a
# manual `aws ecr create-repository` per app before Terraform can even
# run - see infra/terraform/README.md's usage section for the exact
# build/push commands once these exist.
#
# Terraform cannot build or push the images themselves (docker build/push
# aren't AWS API calls) - that remains a manual (or CI-pipeline) step.

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "storefront" {
  name                 = "${local.name_prefix}-storefront"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "seller_portal" {
  name                 = "${local.name_prefix}-seller-portal"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "admin" {
  name                 = "${local.name_prefix}-admin"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keeps each repo from accumulating untagged image layers forever (every
# `docker push` to the same tag orphans the previous layer as untagged) -
# expires anything untagged after 7 days. Tagged images (your actual
# release history) are never touched by this rule.
locals {
  ecr_lifecycle_policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged images after 7 days"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 7
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "storefront" {
  repository = aws_ecr_repository.storefront.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "seller_portal" {
  repository = aws_ecr_repository.seller_portal.name
  policy     = local.ecr_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "admin" {
  repository = aws_ecr_repository.admin.name
  policy     = local.ecr_lifecycle_policy
}

# Product images only - see docs/SECURITY.md §10: object storage never
# holds customer/seller PII, only product images. Maps to the S3_BUCKET/
# S3_REGION variables in docs/DEPLOYMENT.md §2.1/§8 - no access-key
# variables needed here, since the backend authenticates to this bucket
# via its ECS task IAM role instead (see iam.tf).
resource "aws_s3_bucket" "product_images" {
  bucket = var.product_images_bucket_name

  tags = { Name = "${local.name_prefix}-product-images" }
}

resource "aws_s3_bucket_versioning" "product_images" {
  bucket = aws_s3_bucket.product_images.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Images are served through the backend's own file-serving route (or a
# CDN in front of it - docs/DEPLOYMENT.md §3), not directly from a public
# bucket - hence blocking all public access above and granting the
# backend's ECS task role read+write instead (see iam.tf).
resource "aws_s3_bucket_cors_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = ["https://${local.storefront_domain}", "https://${local.seller_portal_domain}", "https://${local.admin_domain}"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

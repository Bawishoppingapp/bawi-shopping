# Product images only - see docs/SECURITY.md §10: object storage never
# holds customer/seller PII, only product images. Maps to the
# S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY variables in
# docs/DEPLOYMENT.md §2.1/§8.
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
# backend's own IAM user/role read+write instead (see iam.tf).
resource "aws_s3_bucket_cors_configuration" "product_images" {
  bucket = aws_s3_bucket.product_images.id

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = ["https://${local.storefront_domain}", "https://${local.seller_portal_domain}", "https://${local.admin_domain}"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}

# Dedicated IAM user + access key for the backend's S3_ACCESS_KEY_ID/
# S3_SECRET_ACCESS_KEY (docs/DEPLOYMENT.md §2.1) - scoped to only this one
# bucket, never broader AWS access.
resource "aws_iam_user" "backend_s3" {
  name = "${local.name_prefix}-backend-s3"
}

resource "aws_iam_user_policy" "backend_s3" {
  name = "${local.name_prefix}-backend-s3-policy"
  user = aws_iam_user.backend_s3.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.product_images.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.product_images.arn
      }
    ]
  })
}

resource "aws_iam_access_key" "backend_s3" {
  user = aws_iam_user.backend_s3.name
}

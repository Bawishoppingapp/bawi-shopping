# Every default below is deliberately the smallest/cheapest reasonable
# option for a first apply, or a clearly-fake placeholder value - see
# infra/terraform/README.md and terraform.tfvars.example. None of these
# variables can enable live payments or any other real-operation feature
# flag; that switch is handled entirely outside Terraform (see
# docs/LAUNCH-CHECKLIST.md §12).

variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name, used in resource names/tags (e.g. \"staging\", \"production\")."
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Root domain this environment serves (e.g. \"example.com\"). A Route53 hosted zone for this domain must already exist or be created by this module - see dns.tf."
  type        = string
  default     = "example.com"
}

variable "create_hosted_zone" {
  description = "Whether Terraform should create the Route53 hosted zone for domain_name. Set to false if the zone already exists elsewhere (e.g. registered through a different provider) and reference it via data source instead."
  type        = bool
  default     = true
}

variable "alert_email" {
  description = "Email address subscribed to the CloudWatch alarm SNS topic. Placeholder - replace with a real, monitored inbox before relying on these alerts."
  type        = string
  default     = "alerts@example.com"
}

# --- Networking ---

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zone_count" {
  description = "Number of AZs to spread subnets across (2 is the minimum for RDS/ALB high availability)."
  type        = number
  default     = 2
}

# --- Database (RDS PostgreSQL) ---

variable "db_instance_class" {
  description = "RDS instance class. Smallest reasonable default for a first apply - right-size before real production traffic (docs/LAUNCH-CHECKLIST.md §11)."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  description = "RDS allocated storage, in GB."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Database name."
  type        = string
  default     = "bawi_shopping_production"
}

variable "db_username" {
  description = "Master database username."
  type        = string
  default     = "bawi_shopping_admin"
}

variable "db_password" {
  description = "Master database password. NO DEFAULT - a real value must be supplied (e.g. via a *.auto.tfvars.json file kept out of version control, or a real secrets manager / TF_VAR_db_password env var). Never commit a real value."
  type        = string
  sensitive   = true
}

variable "db_backup_retention_days" {
  description = "RDS automated backup retention period, in days."
  type        = number
  default     = 7
}

variable "db_multi_az" {
  description = "Whether RDS runs Multi-AZ (real production high availability). false by default to keep a first apply cheap - set true before real launch traffic."
  type        = bool
  default     = false
}

# --- Cache (ElastiCache Redis) ---

variable "redis_node_type" {
  description = "ElastiCache node type. Smallest reasonable default - see docs/DEPLOYMENT.md §9 for why Redis becomes required once running more than one backend instance."
  type        = string
  default     = "cache.t4g.micro"
}

# --- Object storage ---

variable "product_images_bucket_name" {
  description = "S3 bucket name for product images. Must be globally unique across all of AWS - the default below is a placeholder that will not work as-is."
  type        = string
  default     = "bawi-shopping-product-images-replace-with-unique-name"
}

# --- Container images ---
# Leave all four unset (null) and this module creates its own ECR
# repository per app (ecr.tf) and points every task definition at
# "<that repo's URL>:latest" automatically - see local.backend_image
# etc. in main.tf. You still have to build and push the four images
# yourself (Terraform cannot do that part - docker build/push are not
# AWS API calls), but you no longer have to manually copy a URI into a
# tfvars file first. Only set one of these explicitly if you're using a
# registry Terraform didn't create here (e.g. Docker Hub, a
# pre-existing ECR repo).

variable "backend_image" {
  description = "Container image URI for apps/backend. Leave null to use the ECR repo this module creates (aws_ecr_repository.backend)."
  type        = string
  default     = null
}

variable "storefront_image" {
  description = "Container image URI for apps/storefront. Leave null to use the ECR repo this module creates."
  type        = string
  default     = null
}

variable "seller_portal_image" {
  description = "Container image URI for apps/seller-portal. Leave null to use the ECR repo this module creates."
  type        = string
  default     = null
}

variable "admin_image" {
  description = "Container image URI for apps/admin. Leave null to use the ECR repo this module creates."
  type        = string
  default     = null
}

# --- Frontend keys created only after the backend's first deploy ---
# Both genuinely cannot have a working value before the environment
# exists (docs/DEPLOYMENT.md §5 steps 6-7) - leave blank on the first
# apply, fill in and re-apply once you have them.

variable "medusa_publishable_key" {
  description = "Storefront's MEDUSA_PUBLISHABLE_KEY, created in the Medusa admin after the first deploy. Blank until then."
  type        = string
  default     = ""
}

variable "stripe_publishable_key" {
  description = "Storefront's NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (test-mode pk_test_... until go-live - docs/LAUNCH-CHECKLIST.md §12). Blank until you've registered with Stripe."
  type        = string
  default     = ""
}

# --- Backend application secrets ---
# All NO DEFAULT - real values must be supplied per docs/DEPLOYMENT.md §2.1.
# Stripe is deliberately TEST-mode only here - see README.md and
# docs/LAUNCH-CHECKLIST.md §12 for why a live key is never wired through
# this module.

variable "jwt_secret" {
  description = "Backend JWT_SECRET - generate a long random string, unique to this environment."
  type        = string
  sensitive   = true
}

variable "cookie_secret" {
  description = "Backend COOKIE_SECRET - generate a long random string, unique to this environment."
  type        = string
  sensitive   = true
}

variable "auth_mfa_encryption_key" {
  description = "Backend AUTH_MFA_ENCRYPTION_KEY - a 64-character hex string (openssl rand -hex 32)."
  type        = string
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe platform-account secret key. TEST MODE ONLY (sk_test_...) - this module has no path to a live key; see docs/LAUNCH-CHECKLIST.md §12 for the deliberately-manual go-live switch."
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Signing secret for this environment's Stripe webhook endpoint (register the endpoint manually first - docs/DEPLOYMENT.md §2.4)."
  type        = string
  sensitive   = true
  default     = ""
}

# --- Task sizing ---

variable "backend_task_cpu" {
  description = "Fargate task CPU units for the backend service (1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "backend_task_memory" {
  description = "Fargate task memory, in MB, for the backend service."
  type        = number
  default     = 1024
}

variable "frontend_task_cpu" {
  description = "Fargate task CPU units for each frontend service."
  type        = number
  default     = 256
}

variable "frontend_task_memory" {
  description = "Fargate task memory, in MB, for each frontend service."
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired running task count per service. 1 by default (cheapest); run at least 2 per service for real production availability, which also requires REDIS_URL to be set - see docs/DEPLOYMENT.md §9."
  type        = number
  default     = 1
}

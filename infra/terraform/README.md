# Bawi Shopping — Production Infrastructure (Terraform, AWS)

Infrastructure-as-code for a real production deployment: networking, container
hosting for all four apps, managed Postgres, managed Redis, object storage,
DNS/TLS, secrets, and monitoring/alerting/backups. **This is a template with
placeholder values, not a deployed environment** — nothing here has been
applied against a real AWS account (this session has no AWS credentials).
See `docs/DEPLOYMENT.md` and `docs/LAUNCH-CHECKLIST.md` for how this fits
into the overall launch process, and `DEPLOYMENT-SEQUENCE.md` in this same
directory for the full phase-by-phase walkthrough with checkpoints.

AWS was chosen as the default cloud provider since none was specified
elsewhere in this project (`docs/ARCHITECTURE.md` explicitly deferred that
choice) — swap providers if you use something else; the shape (compute +
managed Postgres + managed Redis + object storage + DNS/TLS + alerting)
stays the same regardless of provider.

## Audit pass: what changed and why

A second, more careful pass through this module (checking real AWS-side
constraints, not just `terraform validate`'s HCL syntax/type checking)
found and fixed genuine issues before anything gets applied for real:

- **Real bug: two of the four ALB target group names exceeded AWS's
  hard 32-character limit** (`bawi-shopping-production-seller-portal` is
  38 characters; `bawi-shopping-production-storefront` is 35). This is
  an AWS API-side constraint `terraform validate`/`plan` cannot catch
  without real credentials to actually try creating the resource — found
  by manually computing every resource name's length. Fixed with a
  short, length-safe `local.alb_prefix` (`main.tf`) used only for
  ALB/target-group names, capped at 9 characters regardless of how long
  `environment` is ever set to.
- **Missing `health_check_grace_period_seconds`** on all four ECS
  services — without it, ECS can cycle a task for failing its ALB health
  check before the application has even finished booting. Added,
  generously sized for the backend (a real Medusa boot against a real
  RDS connection, not a static file server).
- **Static IAM user + access key for S3 access, replaced with an ECS
  task IAM role.** Confirmed by reading `@medusajs/file-s3`'s own source
  (`node_modules/@medusajs/file-s3/dist/services/s3-file.js`) that it
  supports `authentication_method: "s3-iam-role"`, which uses the AWS
  SDK's default credential chain — inside ECS, that resolves
  automatically from the task's IAM role, with zero static credentials
  anywhere. `medusa-config.ts` now uses this mode whenever
  `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` aren't explicitly set.
- **Secrets moved to AWS Secrets Manager** (`secrets.tf`) — the database
  connection string, JWT/cookie secrets, the MFA encryption key, and both
  Stripe keys are no longer plaintext `environment` entries in the task
  definition (an explicitly flagged accepted-simplification from the
  first pass, now actually closed rather than left as a to-do). The
  execution role's Secrets Manager access is scoped to exactly these six
  secrets, never a wildcard.
- **ECR repositories are now created by this module** (`ecr.tf`) instead
  of requiring a manual `aws ecr create-repository` per app before
  Terraform can even run. `backend_image`/`storefront_image`/
  `seller_portal_image`/`admin_image` are now optional — leave them
  unset and every task definition automatically points at
  `<the repo this module created>:latest`.
- **`deregistration_delay` shortened** from AWS's 300-second default to
  30 seconds on every target group, so a rolling deploy doesn't leave a
  drained-but-still-registered old task around for five minutes each
  time — safe here since these are stateless HTTP services.

## What this provisions

| Concern | AWS service | Maps to |
|---|---|---|
| Container hosting | ECS Fargate (4 services, one per app) behind one Application Load Balancer with host-based routing | `docs/DEPLOYMENT.md` §1's four deployables |
| Container registry | One ECR repository per app, image scanning on push | See `ecr.tf` |
| PostgreSQL | RDS for PostgreSQL, Multi-AZ optional | `DATABASE_URL` (via Secrets Manager) |
| Redis | ElastiCache for Redis | `REDIS_URL` (§2.1, §9) |
| Object storage | S3 bucket, private, versioned, IAM-role access (no static keys) | `S3_BUCKET` (§2.1, §8) |
| Secrets | AWS Secrets Manager — DB URL, JWT/cookie secrets, MFA key, Stripe keys | `docs/DEPLOYMENT.md` §2.1 |
| Domain / DNS / TLS | Route53 hosted zone + ACM certificate (DNS-validated) | `STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS`, `MEDUSA_BACKEND_URL`, etc. |
| Monitoring / alerting | CloudWatch log groups + alarms (CPU, 5xx rate, DB connections, Redis memory) + an SNS topic | Closes the "nothing wired" gap in `docs/DEPLOYMENT.md` §7 |
| Backups | RDS automated backups + snapshot retention, S3 versioning | `docs/DEPLOYMENT.md` §6 |

Subdomains follow the same scheme already used as an example throughout
`docs/DEPLOYMENT.md`: `shop.<domain>` (storefront), `sell.<domain>`
(seller-portal), `admin.<domain>` (admin + courier portal), `api.<domain>`
(backend).

## What this does NOT do

- **Does not build or push container images.** `docker build`/`docker push`
  aren't AWS API calls, so Terraform genuinely cannot do this part — but
  it does create the ECR repository to push *to* (see above). A CI/CD
  pipeline doing this on every release is a reasonable next step, not
  included here.
- **Does not run migrations.** Run `npx medusa db:migrate` against the
  provisioned RDS instance yourself after the first `terraform apply` (see
  `docs/DEPLOYMENT.md` §5) — a one-off ECS task (using the same task
  definition, command overridden) is the recommended way to reach an RDS
  instance that's deliberately not publicly accessible.
- **Does not create the Medusa admin user, publishable API key, or Stripe
  webhook** — all still manual, one-time steps per `docs/DEPLOYMENT.md` §5.
- **Does not set `live_payments_enabled` or any other real-operation feature
  flag, and does not accept live Stripe keys as a variable** — that switch
  is deliberately not automated by this module; see `docs/LAUNCH-CHECKLIST.md`
  §12.

## Usage

This is a two-pass process the first time, because the ECS services need a
real image to exist before they can start — and that image can't exist
until the ECR repos Terraform creates already exist.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: real domain name, real alert email, a real
# db_password and generated secrets. Leave the four *_image variables
# commented out for now.

terraform init
terraform validate
terraform plan     # review every resource before creating anything real
terraform apply    # creates networking, RDS, Redis, the ALB, and the ECR repos

# Build and push each image to the repo this apply just created -
# terraform output ecr_repository_urls shows all four URLs:
aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker build -f apps/backend/Dockerfile -t bawi-backend .
docker tag bawi-backend:latest <backend-ecr-url>:latest
docker push <backend-ecr-url>:latest
# repeat for storefront, seller-portal, admin

# The ECS services were already created against an image that didn't
# exist yet and are stuck retrying - now that you've pushed something,
# force them to actually pick it up:
aws ecs update-service --cluster <cluster-name> --service <service-name> --force-new-deployment
# repeat per service, or just re-run `terraform apply` again - either works
```

## Cost note

Every instance size/count in `variables.tf` defaults to the smallest
reasonable option (e.g. `db.t4g.micro`, single ECS task per service, no
Multi-AZ) so a first `apply` is cheap to experiment with — not sized for
real production traffic. Review and right-size before real launch traffic
per `docs/LAUNCH-CHECKLIST.md` §11's load-testing step.

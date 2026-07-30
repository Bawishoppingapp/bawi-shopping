# Bawi Shopping — Production Infrastructure (Terraform, AWS)

Infrastructure-as-code for a real production deployment: networking, container
hosting for all four apps, managed Postgres, managed Redis, object storage,
DNS/TLS, and monitoring/alerting/backups. **This is a template with
placeholder values, not a deployed environment** — nothing here has been
applied against a real AWS account (this session has no AWS credentials).
See `docs/DEPLOYMENT.md` and `docs/LAUNCH-CHECKLIST.md` for how this fits
into the overall launch process.

AWS was chosen as the default cloud provider since none was specified
elsewhere in this project (`docs/ARCHITECTURE.md` explicitly deferred that
choice) — swap providers if you use something else; the shape (compute +
managed Postgres + managed Redis + object storage + DNS/TLS + alerting)
stays the same regardless of provider.

## What this provisions

| Concern | AWS service | Maps to |
|---|---|---|
| Container hosting | ECS Fargate (4 services, one per app) behind one Application Load Balancer with host-based routing | `docs/DEPLOYMENT.md` §1's four deployables |
| PostgreSQL | RDS for PostgreSQL, Multi-AZ optional | `DATABASE_URL` |
| Redis | ElastiCache for Redis | `REDIS_URL` (§2.1, §9) |
| Object storage | S3 bucket, private, versioned | `S3_BUCKET`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (§2.1, §8) |
| Domain / DNS / TLS | Route53 hosted zone + ACM certificate (DNS-validated) | `STORE_CORS`/`ADMIN_CORS`/`AUTH_CORS`, `MEDUSA_BACKEND_URL`, etc. |
| Monitoring / alerting | CloudWatch log groups + alarms (CPU, 5xx rate, DB connections, Redis memory) + an SNS topic | Closes the "nothing wired" gap in `docs/DEPLOYMENT.md` §7 |
| Backups | RDS automated backups + snapshot retention, S3 versioning | `docs/DEPLOYMENT.md` §6 |

Subdomains follow the same scheme already used as an example throughout
`docs/DEPLOYMENT.md`: `shop.<domain>` (storefront), `sell.<domain>`
(seller-portal), `admin.<domain>` (admin + courier portal), `api.<domain>`
(backend).

## What this does NOT do

- **Does not build or push container images.** ECS task definitions reference
  an image URI you provide (`var.*_image`) — build and push
  `apps/*/Dockerfile` to a registry (ECR or otherwise) first, then point
  these variables at the pushed tags. A CI/CD pipeline doing this on every
  release is a reasonable next step, not included here.
- **Does not run migrations.** Run `npx medusa db:migrate` against the
  provisioned RDS instance yourself after the first `terraform apply` (see
  `docs/DEPLOYMENT.md` §5) — a one-off ECS task or a bastion/VPN connection
  is the usual way to reach an RDS instance that's deliberately not
  publicly accessible.
- **Does not create the Medusa admin user, publishable API key, or Stripe
  webhook** — all still manual, one-time steps per `docs/DEPLOYMENT.md` §5.
- **Does not set `live_payments_enabled` or any other real-operation feature
  flag, and does not accept live Stripe keys as a variable** — that switch
  is deliberately not automated by this module; see `docs/LAUNCH-CHECKLIST.md`
  §12.

## Usage

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: real domain name, real alert email, real image URIs
# after you've built and pushed them, a real db_password (or wire a secrets
# manager - see the note in variables.tf).

terraform init
terraform validate
terraform plan    # review every resource before creating anything real
terraform apply   # only once you've reviewed the plan and have real AWS credentials
```

## Cost note

Every instance size/count in `variables.tf` defaults to the smallest
reasonable option (e.g. `db.t4g.micro`, single ECS task per service, no
Multi-AZ) so a first `apply` is cheap to experiment with — not sized for
real production traffic. Review and right-size before real launch traffic
per `docs/LAUNCH-CHECKLIST.md` §11's load-testing step.

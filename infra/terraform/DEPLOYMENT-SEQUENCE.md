# Deployment Sequence — Real Cloud Infrastructure

Nine phases, in order, from "Terraform is written but never deployed" to a
running production environment. Every phase states plainly what's already
done, what you still need to do, and stops at a checkpoint before the next
phase begins. Don't skip a checkpoint — each one exists because the next
phase depends on it.

Two phases interleave in a way that's worth understanding up front: **Phase
4 (Terraform) actually runs in two parts**, with **Phase 3 (image
build/publish) happening in between them** — the ECS services need a real
container image to exist, but the ECR repository to push that image *to*
is itself created by the first Terraform apply. This isn't a workaround;
it's the real, correct order. Phase 3 and Phase 4 below explain exactly
where the split happens.

---

## Phase 1 — Repository and infrastructure validation

**Claude already did this, this session.** A second, more careful audit
pass (not just re-confirming the first pass was fine) found and fixed
real issues:

- ✅ Fixed a real bug: two of four ALB target group names exceeded AWS's
  32-character limit (`terraform validate` cannot catch this — it's an
  AWS API-side constraint, not an HCL syntax rule). Verified the fix by
  computing every resource name's length, not just re-running `validate`.
- ✅ Added `health_check_grace_period_seconds` to all four ECS services.
- ✅ Replaced the static S3 IAM user + access key with an ECS task IAM
  role, verified against `@medusajs/file-s3`'s actual source code (not
  assumed) to confirm it supports IAM-role-based authentication.
- ✅ Moved six secrets (DB connection string, JWT secret, cookie secret,
  MFA key, both Stripe keys) from plaintext task-definition environment
  variables to AWS Secrets Manager, scoped access to exactly those six.
- ✅ Added ECR repository creation to Terraform itself, removing the
  "manually run `aws ecr create-repository`, then copy the URI into
  tfvars" step.
- ✅ Shortened target-group `deregistration_delay` from AWS's 300s
  default to 30s for faster rolling deploys.
- ✅ `terraform fmt`, `terraform init -backend=false`, `terraform
  validate`, and a `terraform plan` dry-run all ran clean — the plan
  stops only at "no AWS credentials found," exactly as expected with no
  cloud account attached to this environment.
- ✅ All four Dockerfiles have a `HEALTHCHECK` instruction matching the
  ALB target-group health-check paths.
- ✅ Backend typecheck, lint, unit tests (206 passing), and production
  build all still pass after the `medusa-config.ts` changes this pass
  required (see Phase 9's final verification for the full re-run).

Full detail on everything fixed: `infra/terraform/README.md`'s "Audit
pass: what changed and why" section.

**✅ CHECKPOINT — nothing required from you yet.** Read the audit summary
above and in `README.md` if you want the full reasoning; otherwise move
straight to Phase 2.

---

## Phase 2 — AWS account prerequisites

**This phase is entirely yours** — it needs a real AWS account and real
payment information, neither of which Claude has or should ever handle
(see this project's own action-category rules on financial/account
actions).

1. Create an AWS account at [aws.amazon.com](https://aws.amazon.com) if
   you don't have one, and attach a billing method.
2. Create an IAM user for Terraform to use: **IAM → Users → Create user**
   → attach the `AdministratorAccess` policy for this first apply (scope
   it down to something narrower once everything works, if you want) →
   **Security credentials → Create access key**.
3. Install the AWS CLI, then run:
   ```bash
   aws configure
   # paste in the Access Key ID and Secret Access Key from step 2
   # set your default region (e.g. us-east-1)
   ```
4. Confirm it worked:
   ```bash
   aws sts get-caller-identity
   ```
   This should print your AWS account ID and the IAM user's ARN, not an
   error.
5. Decide on your domain — either register a new one via **Route53 →
   Registered domains → Register domain**, or note that you'll point an
   existing domain's nameservers at Route53 later (Phase 5).

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] `aws sts get-caller-identity` returns your account, not an error.
- [ ] You know which domain you're using.
- [ ] You've decided on an AWS region (default `us-east-1` if unsure).

Don't move to Phase 4 until both of the above are true — every Terraform
command from here on needs real, working AWS credentials to do anything.

---

## Phase 3 — Container image build and publishing (part 1 of 2)

**Nothing to do yet in this phase** — the ECR repositories these images
get pushed to don't exist until Phase 4's first `terraform apply`
creates them. Skip ahead to Phase 4 now; you'll come back here
immediately after Phase 4's first apply completes.

---

## Phase 4 — Terraform deployment (part 1: create infrastructure + ECR)

**Mixed.** Claude wrote and validated every file in `infra/terraform/`;
running it is yours, since it needs your real AWS credentials from
Phase 2.

1. ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   ```
2. Edit `terraform.tfvars`:
   - `domain_name` — your real domain from Phase 2.
   - `alert_email` — a real, monitored inbox (CloudWatch alarms send here).
   - `product_images_bucket_name` — must be globally unique across all of
     AWS; add something distinctive (your company name + a random suffix).
   - `db_password`, `jwt_secret`, `cookie_secret`, `auth_mfa_encryption_key`
     — generate real values:
     ```bash
     openssl rand -base64 32   # for db_password, jwt_secret, cookie_secret
     openssl rand -hex 32      # for auth_mfa_encryption_key
     ```
   - Leave `backend_image`/`storefront_image`/`seller_portal_image`/
     `admin_image` **commented out** — this first apply creates the ECR
     repos those default to.
   - Leave `stripe_secret_key`/`stripe_webhook_secret`/
     `medusa_publishable_key`/`stripe_publishable_key` blank — Phase 7/8.
3. ```bash
   terraform init
   terraform validate
   terraform plan
   ```
   **Read the plan output.** It lists every single resource about to be
   created — this is your last chance to catch something wrong before it
   costs money or exists for real.
4. ```bash
   terraform apply
   ```
   Type `yes` when prompted. This takes several minutes (RDS and
   ElastiCache are the slow parts). When it finishes, run:
   ```bash
   terraform output ecr_repository_urls
   ```
   and keep those four URLs handy — you need them right now, in Phase 3.

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] `terraform apply` completed with no errors.
- [ ] `terraform output ecr_repository_urls` shows four real URLs.

Now go back to Phase 3 to actually build and push images — then return
here for Phase 4's second part.

---

## Phase 3 — Container image build and publishing (part 2 of 2)

**Yours** — Docker build/push are not AWS API calls, so Terraform
genuinely cannot do this part.

```bash
aws ecr get-login-password --region <your-region> | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# repeat this build/tag/push trio for each of the four apps -
# backend shown, storefront/seller-portal/admin follow the same pattern:
docker build -f apps/backend/Dockerfile -t bawi-backend .
docker tag bawi-backend:latest <backend-ecr-url-from-phase-4>:latest
docker push <backend-ecr-url-from-phase-4>:latest
```

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] All four images pushed successfully (check **ECR → repositories**
  in the AWS Console — each should show one `latest` tag).

---

## Phase 4 — Terraform deployment (part 2: pick up the pushed images)

The ECS services were created in part 1 against an image that didn't
exist yet, so they've been stuck retrying since then. Now that real
images exist:

```bash
cd infra/terraform
terraform apply    # no changes to your config, but ECS picks up the pushed images
```

Or, faster, force each service individually without a full Terraform run:
```bash
aws ecs update-service --cluster <cluster-name> --service <service-name> --force-new-deployment
```
(`terraform output ecs_cluster_name` for the cluster name; service names
follow the pattern `bawi-shopping-<environment>-<app>`.)

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] **ECS → Clusters → your cluster** shows all four services with
  running task count matching desired count (1 each, by default).
- [ ] If a service won't stabilize, check **Logs** (CloudWatch → the log
  group for that service) before continuing — a crash-looping task means
  something is wrong with that image or its environment, not with
  Terraform.

---

## Phase 5 — DNS verification

**Mostly automatic, one manual check depending on your domain.**

- **If you registered your domain through Route53 in Phase 2**, DNS is
  already fully configured — Terraform's `aws_acm_certificate_validation`
  resource waited synchronously during Phase 4's apply for the TLS
  certificate to actually validate, so if `apply` succeeded, this is
  already done. Nothing further needed.
- **If your domain is registered elsewhere**, get the real name servers:
  ```bash
  terraform output route53_name_servers
  ```
  and update your registrar's NS records to point at them. This can take
  anywhere from a few minutes to 48 hours to propagate, depending on your
  registrar and DNS TTLs.

Either way, confirm it's actually working:
```bash
dig shop.<your-domain>
curl -sI https://shop.<your-domain>
curl -sI https://api.<your-domain>/health
```

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] `dig shop.<your-domain>` resolves to an IP (the ALB's).
- [ ] `curl -sI https://api.<your-domain>/health` returns `200` with a
  valid TLS handshake (no certificate warning).

---

## Phase 6 — Database migration

**Yours to trigger, using a one-off ECS task** — the RDS instance is
deliberately not publicly reachable (`publicly_accessible = false`),
so this is the standard way to run a one-time command against it.

```bash
aws ecs run-task \
  --cluster <cluster-name> \
  --task-definition <backend-task-definition-arn> \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnet-ids>],securityGroups=[<ecs-tasks-sg-id>]}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","medusa","db:migrate"]}]}'
```

(`terraform output` doesn't currently print the subnet/security-group IDs
directly — get them from `terraform show` or the AWS Console: **VPC →
Subnets** filtered by the `bawi-shopping-<environment>-private-*` tag,
and **EC2 → Security Groups** for `bawi-shopping-<environment>-ecs-tasks`.)

Watch it run in **ECS → Clusters → your cluster → Tasks**, then check its
CloudWatch logs (same log group as the backend service) for "Migrations
completed" — the same success message you'd see running this locally.

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] The one-off task's logs show migrations completed successfully,
  not an error.

---

## Phase 7 — Admin account creation

**Same one-off-task pattern as Phase 6, different command:**

```bash
aws ecs run-task \
  --cluster <cluster-name> \
  --task-definition <backend-task-definition-arn> \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnet-ids>],securityGroups=[<ecs-tasks-sg-id>]}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","medusa","user","-e","you@example.com","-p","<a-real-password>"]}]}'
```

Then log into `https://admin.<your-domain>` with that email/password, and
while you're there: **Settings → Publishable API Keys → Create one**,
scoped to the storefront's sales channel.

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] You can log into the admin app.
- [ ] You have a publishable API key copied somewhere safe — you need it
  in a moment.

Update `terraform.tfvars`'s `medusa_publishable_key` with that value now
(you can also wait and do it together with Phase 8's Stripe values in one
apply).

---

## Phase 8 — Stripe configuration

**Yours** — this needs your real Stripe account.

1. In the [Stripe Dashboard](https://dashboard.stripe.com), stay in
   **test mode** for now (see `docs/LAUNCH-CHECKLIST.md` §12 for the
   separate, later, deliberate go-live step).
2. **Developers → Webhooks → Add endpoint** →
   `https://api.<your-domain>/webhooks/stripe`, subscribed to at minimum:
   `payment_intent.succeeded`, `payment_intent.payment_failed`,
   `account.updated`, `charge.dispute.created`, `charge.dispute.closed`.
3. Copy the endpoint's signing secret and the test-mode secret key
   (`sk_test_...`) and test-mode publishable key (`pk_test_...`).
4. Update `terraform.tfvars`:
   ```hcl
   stripe_secret_key       = "sk_test_..."
   stripe_webhook_secret   = "whsec_..."
   stripe_publishable_key  = "pk_test_..."
   medusa_publishable_key  = "<from Phase 7, if not already set>"
   ```
5. ```bash
   terraform apply
   ```

**⏹ CHECKPOINT — confirm before continuing:**
- [ ] `terraform apply` completed with the new values.
- [ ] Stripe Dashboard's webhook page shows successful deliveries once
  you complete Phase 9's checkout test (it'll show nothing yet — that's
  expected until you actually place a test order).

---

## Phase 9 — Production verification

**Yours to run, following `docs/LAUNCH-CHECKLIST.md` §5's smoke test**
against this real environment instead of local dev servers:

1. Register a customer → submit and approve a seller application →
   activate the seller → create and approve a product → add to cart →
   complete a test-mode checkout → confirm the Stripe webhook fires and
   splits the order → confirm an in-app notification appears.
2. Confirm `/legal/terms`, `/legal/privacy`, etc. render on the real
   storefront domain.
3. Confirm security headers on a live response:
   ```bash
   curl -sI https://shop.<your-domain>/ | grep -i content-security-policy
   ```
4. Run the real load test against this environment (not a local dry run):
   ```bash
   k6 run -e BASE_URL=https://shop.<your-domain> \
     -e BACKEND_URL=https://api.<your-domain> load-testing/load.js
   ```
5. Confirm CloudWatch alarms exist and are in `OK` state: **CloudWatch →
   Alarms** — you should see one per service/CPU, memory, ALB 5xx, RDS
   CPU/storage/connections, and Redis memory.
6. Run the production-readiness check as one more one-off task (same
   pattern as Phase 6/7, command `["npx","medusa","exec","./src/scripts/check-production-readiness.ts"]`)
   and review its output — see `docs/DEPLOYMENT.md` §4.1 and
   `docs/LAUNCH-CHECKLIST.md` §6 for what to do with what it reports.

**✅ Once every item above passes, this environment is technically
deployed and verified** — it is still not launched with real money moving
through it. That's `docs/LAUNCH-CHECKLIST.md` §7 (legal review), §4
(business decisions), and finally §12 (the deliberate go-live sequence),
none of which this deployment sequence covers, and none of which Claude
performs on your behalf — see that document for exactly what's left.

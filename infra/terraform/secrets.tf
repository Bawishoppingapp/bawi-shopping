# Every genuinely sensitive backend value, one secret each, read by the
# backend container at task start via ecs.tf's `secrets` block - not
# passed as plaintext `environment` entries. This closes a gap an earlier
# pass flagged explicitly as an accepted simplification rather than
# leaving it as a silent to-do.
#
# recovery_window_in_days = 0 means a `terraform destroy` deletes these
# immediately rather than the default 30-day recovery window - correct
# for a module whose whole purpose is repeatable apply/destroy cycles
# during setup; reconsider for a long-lived production account where an
# accidental destroy should be recoverable.

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name_prefix}/database-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:5432/${var.db_name}"
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${local.name_prefix}/jwt-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

resource "aws_secretsmanager_secret" "cookie_secret" {
  name                    = "${local.name_prefix}/cookie-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "cookie_secret" {
  secret_id     = aws_secretsmanager_secret.cookie_secret.id
  secret_string = var.cookie_secret
}

resource "aws_secretsmanager_secret" "auth_mfa_encryption_key" {
  name                    = "${local.name_prefix}/auth-mfa-encryption-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "auth_mfa_encryption_key" {
  secret_id     = aws_secretsmanager_secret.auth_mfa_encryption_key.id
  secret_string = var.auth_mfa_encryption_key
}

# Test-mode by default (var.stripe_secret_key defaults to ""); this
# module has no path to a live key regardless of what's stored here -
# see docs/LAUNCH-CHECKLIST.md §12.
resource "aws_secretsmanager_secret" "stripe_secret_key" {
  name                    = "${local.name_prefix}/stripe-secret-key"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "stripe_secret_key" {
  secret_id     = aws_secretsmanager_secret.stripe_secret_key.id
  secret_string = var.stripe_secret_key
}

resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name                    = "${local.name_prefix}/stripe-webhook-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.stripe_webhook_secret.id
  secret_string = var.stripe_webhook_secret
}

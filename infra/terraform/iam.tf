# Every IAM role/policy for this module lives here, consolidated in one
# place for easier audit - split across ecs.tf/storage.tf in an earlier
# pass, moved here since IAM is exactly the kind of thing worth reviewing
# as a single unit rather than discovering piece by piece.
#
# Two distinct roles, an important AWS distinction this module gets
# right on purpose:
#   - ecs_task_execution: what ECS itself assumes to pull the container
#     image, write logs, and fetch Secrets Manager values *before* your
#     application code ever runs.
#   - ecs_task: what your application code can assume *while running*.
#     Used here so the backend's S3 access works via the AWS SDK's
#     default credential chain (see medusa-config.ts's
#     `authentication_method: "s3-iam-role"`) - no static access key
#     anywhere, which is the actual AWS-recommended pattern for a
#     workload running on AWS's own compute.

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Scoped to exactly the six secrets this backend needs - never a
# wildcard resource, so a compromised task execution role can't read any
# other secret in this AWS account.
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${local.name_prefix}-secrets-access"
  role = aws_iam_role.ecs_task_execution.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.jwt_secret.arn,
        aws_secretsmanager_secret.cookie_secret.arn,
        aws_secretsmanager_secret.auth_mfa_encryption_key.arn,
        aws_secretsmanager_secret.stripe_secret_key.arn,
        aws_secretsmanager_secret.stripe_webhook_secret.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json
}

# Scoped to exactly this one bucket - never broader S3 or AWS access.
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-backend-s3-policy"
  role = aws_iam_role.ecs_task.name

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

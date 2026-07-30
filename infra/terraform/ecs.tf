resource "aws_ecs_cluster" "main" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_lb" "main" {
  name               = "${local.alb_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "${local.name_prefix}-alb" }
}

# HTTP -> HTTPS redirect. Real production traffic should never be served
# over plain HTTP - see docs/SECURITY.md's Strict-Transport-Security note.
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main.certificate_arn

  # No default backend is meaningful across four unrelated apps -
  # respond with a plain 404 unless a host-header rule below matches.
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

# --- Target groups + listener rules, one per app, routed by host header ---
#
# Names use local.alb_prefix, not local.name_prefix - see main.tf's
# comment. deregistration_delay is shortened from AWS's 300s default to
# 30s so rolling deploys (a new task definition revision) don't leave a
# draining-but-still-registered old task around for five minutes each
# time - safe here since these are stateless HTTP services with no
# long-lived connections to drain.

resource "aws_lb_target_group" "backend" {
  name                 = "${local.alb_prefix}-backend"
  port                 = 9000
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }
}

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header {
      values = [local.backend_domain]
    }
  }
}

resource "aws_lb_target_group" "storefront" {
  name                 = "${local.alb_prefix}-storefront"
  port                 = 3000
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }
}

resource "aws_lb_listener_rule" "storefront" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.storefront.arn
  }

  condition {
    host_header {
      values = [local.storefront_domain]
    }
  }
}

resource "aws_lb_target_group" "seller_portal" {
  name                 = "${local.alb_prefix}-seller-portal"
  port                 = 3001
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }
}

resource "aws_lb_listener_rule" "seller_portal" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.seller_portal.arn
  }

  condition {
    host_header {
      values = [local.seller_portal_domain]
    }
  }
}

resource "aws_lb_target_group" "admin" {
  name                 = "${local.alb_prefix}-admin"
  port                 = 3002
  protocol             = "HTTP"
  vpc_id               = aws_vpc.main.id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }
}

resource "aws_lb_listener_rule" "admin" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 40

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }

  condition {
    host_header {
      values = [local.admin_domain]
    }
  }
}

# --- CloudWatch log groups, one per service ---

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}/backend"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "storefront" {
  name              = "/ecs/${local.name_prefix}/storefront"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "seller_portal" {
  name              = "/ecs/${local.name_prefix}/seller-portal"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "admin" {
  name              = "/ecs/${local.name_prefix}/admin"
  retention_in_days = 30
}

# --- Task definitions ---
# Every backend env var below matches docs/DEPLOYMENT.md §2.1 exactly.
# STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET default to empty strings (see
# variables.tf) - a real apply requires supplying real TEST-mode values;
# this module has no path to a live key (docs/LAUNCH-CHECKLIST.md §12).
#
# Every genuinely sensitive value (DB connection string, JWT/cookie
# secrets, MFA key, Stripe keys) is injected via the container's
# `secrets` block from AWS Secrets Manager (see secrets.tf and iam.tf),
# not passed as plaintext `environment` entries - this was a flagged
# accepted-simplification in an earlier pass, now actually fixed rather
# than left as a to-do. S3 access needs no credential of any kind: the
# backend task assumes aws_iam_role.ecs_task (iam.tf), and
# medusa-config.ts's file-s3 provider is configured with
# `authentication_method: "s3-iam-role"` when no explicit access key is
# supplied, which resolves credentials from that role automatically via
# the AWS SDK's default credential chain - confirmed by reading
# @medusajs/file-s3's own source (node_modules/@medusajs/file-s3/dist/
# services/s3-file.js), not assumed.

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_task_cpu
  memory                   = var.backend_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name         = "backend"
      image        = local.backend_image
      portMappings = [{ containerPort = 9000, protocol = "tcp" }]
      environment = [
        { name = "STORE_CORS", value = "https://${local.storefront_domain}" },
        { name = "ADMIN_CORS", value = "https://${local.admin_domain}" },
        { name = "AUTH_CORS", value = "https://${local.storefront_domain},https://${local.seller_portal_domain},https://${local.admin_domain}" },
        { name = "SELLER_PORTAL_URL", value = "https://${local.seller_portal_domain}" },
        { name = "COURIER_PORTAL_URL", value = "https://${local.admin_domain}/courier" },
        { name = "ENABLE_TEST_SUPPORT_ROUTES", value = "false" },
        { name = "REDIS_URL", value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379" },
        { name = "S3_BUCKET", value = aws_s3_bucket.product_images.bucket },
        { name = "S3_REGION", value = var.aws_region },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt_secret.arn },
        { name = "COOKIE_SECRET", valueFrom = aws_secretsmanager_secret.cookie_secret.arn },
        { name = "AUTH_MFA_ENCRYPTION_KEY", valueFrom = aws_secretsmanager_secret.auth_mfa_encryption_key.arn },
        { name = "STRIPE_SECRET_KEY", valueFrom = aws_secretsmanager_secret.stripe_secret_key.arn },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = aws_secretsmanager_secret.stripe_webhook_secret.arn },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "storefront" {
  family                   = "${local.name_prefix}-storefront"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_task_cpu
  memory                   = var.frontend_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name         = "storefront"
      image        = local.storefront_image
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        { name = "MEDUSA_BACKEND_URL", value = "https://${local.backend_domain}" },
        # Both created manually in the Medusa admin after the backend's
        # first deploy (docs/DEPLOYMENT.md §5 steps 6-7) - there is no
        # publishable key or Stripe account to reference before that
        # point exists, so these can only be filled in on a *second*
        # apply once you have real values, via terraform.tfvars.
        { name = "MEDUSA_PUBLISHABLE_KEY", value = var.medusa_publishable_key },
        { name = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", value = var.stripe_publishable_key },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.storefront.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "storefront"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "seller_portal" {
  family                   = "${local.name_prefix}-seller-portal"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_task_cpu
  memory                   = var.frontend_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name         = "seller-portal"
      image        = local.seller_portal_image
      portMappings = [{ containerPort = 3001, protocol = "tcp" }]
      environment = [
        { name = "MEDUSA_BACKEND_URL", value = "https://${local.backend_domain}" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.seller_portal.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "seller-portal"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "admin" {
  family                   = "${local.name_prefix}-admin"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_task_cpu
  memory                   = var.frontend_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name         = "admin"
      image        = local.admin_image
      portMappings = [{ containerPort = 3002, protocol = "tcp" }]
      environment = [
        { name = "MEDUSA_BACKEND_URL", value = "https://${local.backend_domain}" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.admin.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "admin"
        }
      }
    }
  ])
}

# --- Services ---
#
# health_check_grace_period_seconds matters specifically because these
# services sit behind an ALB: without it, ECS can decide a slow-starting
# task is unhealthy and cycle it before the application has even finished
# booting, especially the backend (a real Medusa boot, not just a static
# file server, observed taking ~11s even in this project's own local dev
# runs - a cold start on a fresh Fargate task with a real RDS connection
# should be assumed slower, not faster).

resource "aws_ecs_service" "backend" {
  name                              = "${local.name_prefix}-backend"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.backend.arn
  desired_count                     = var.desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 90

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 9000
  }

  depends_on = [aws_lb_listener_rule.backend]
}

resource "aws_ecs_service" "storefront" {
  name                              = "${local.name_prefix}-storefront"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.storefront.arn
  desired_count                     = var.desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.storefront.arn
    container_name   = "storefront"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener_rule.storefront]
}

resource "aws_ecs_service" "seller_portal" {
  name                              = "${local.name_prefix}-seller-portal"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.seller_portal.arn
  desired_count                     = var.desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.seller_portal.arn
    container_name   = "seller-portal"
    container_port   = 3001
  }

  depends_on = [aws_lb_listener_rule.seller_portal]
}

resource "aws_ecs_service" "admin" {
  name                              = "${local.name_prefix}-admin"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.admin.arn
  desired_count                     = var.desired_count
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.admin.arn
    container_name   = "admin"
    container_port   = 3002
  }

  depends_on = [aws_lb_listener_rule.admin]
}

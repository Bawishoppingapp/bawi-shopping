resource "aws_ecs_cluster" "main" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
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

resource "aws_lb_target_group" "backend" {
  name        = "${local.name_prefix}-backend"
  port        = 9000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

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
  name        = "${local.name_prefix}-storefront"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

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
  name        = "${local.name_prefix}-seller-portal"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

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
  name        = "${local.name_prefix}-admin"
  port        = 3002
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

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

# --- IAM: ECS task execution role (pulls images, writes logs) ---

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
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
# Accepted simplification, flagged rather than silently shipped: secrets
# (DB password, JWT/cookie secrets, Stripe keys, S3 credentials) are passed
# as plain `environment` entries, which land in Terraform state and the
# task definition itself in plaintext. Good enough for a first apply/
# experiment; before real launch traffic, move these to AWS Secrets
# Manager or SSM Parameter Store and reference them via each container
# definition's `secrets` block instead (requires adding
# secretsmanager:GetSecretValue to aws_iam_role.ecs_task_execution).

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_task_cpu
  memory                   = var.backend_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name         = "backend"
      image        = var.backend_image
      portMappings = [{ containerPort = 9000, protocol = "tcp" }]
      environment = [
        { name = "DATABASE_URL", value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:5432/${var.db_name}" },
        { name = "STORE_CORS", value = "https://${local.storefront_domain}" },
        { name = "ADMIN_CORS", value = "https://${local.admin_domain}" },
        { name = "AUTH_CORS", value = "https://${local.storefront_domain},https://${local.seller_portal_domain},https://${local.admin_domain}" },
        { name = "JWT_SECRET", value = var.jwt_secret },
        { name = "COOKIE_SECRET", value = var.cookie_secret },
        { name = "AUTH_MFA_ENCRYPTION_KEY", value = var.auth_mfa_encryption_key },
        { name = "SELLER_PORTAL_URL", value = "https://${local.seller_portal_domain}" },
        { name = "COURIER_PORTAL_URL", value = "https://${local.admin_domain}/courier" },
        { name = "ENABLE_TEST_SUPPORT_ROUTES", value = "false" },
        { name = "STRIPE_SECRET_KEY", value = var.stripe_secret_key },
        { name = "STRIPE_WEBHOOK_SECRET", value = var.stripe_webhook_secret },
        { name = "REDIS_URL", value = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:6379" },
        { name = "S3_ACCESS_KEY_ID", value = aws_iam_access_key.backend_s3.id },
        { name = "S3_SECRET_ACCESS_KEY", value = aws_iam_access_key.backend_s3.secret },
        { name = "S3_BUCKET", value = aws_s3_bucket.product_images.bucket },
        { name = "S3_REGION", value = var.aws_region },
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
      image        = var.storefront_image
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      environment = [
        { name = "MEDUSA_BACKEND_URL", value = "https://${local.backend_domain}" },
        # MEDUSA_PUBLISHABLE_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY have
        # no working default - see docs/DEPLOYMENT.md §5 steps 6-7; both are
        # created manually after the first apply, then this task definition
        # updated (or supplied as additional terraform variables once known).
        { name = "MEDUSA_PUBLISHABLE_KEY", value = "" },
        { name = "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", value = "" },
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
      image        = var.seller_portal_image
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
      image        = var.admin_image
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

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

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
  name            = "${local.name_prefix}-storefront"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.storefront.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

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
  name            = "${local.name_prefix}-seller-portal"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.seller_portal.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

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
  name            = "${local.name_prefix}-admin"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.admin.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

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

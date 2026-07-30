resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = aws_subnet.private[*].id
}

# Single-node by default (cheapest) - see docs/DEPLOYMENT.md §9: Redis
# becomes required (not just recommended) once more than one backend
# instance runs, since it backs the event bus/cache/locking/workflow
# engine that in-memory defaults can't coordinate across processes.
# Add a replica / enable cluster mode before relying on this for real
# production availability.
resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  tags = { Name = "${local.name_prefix}-redis" }
}

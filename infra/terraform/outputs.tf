output "alb_dns_name" {
  description = "The ALB's own DNS name - useful for debugging before Route53 records propagate."
  value       = aws_lb.main.dns_name
}

output "storefront_url" {
  value = "https://${local.storefront_domain}"
}

output "seller_portal_url" {
  value = "https://${local.seller_portal_domain}"
}

output "admin_url" {
  value = "https://${local.admin_domain}"
}

output "backend_url" {
  value = "https://${local.backend_domain}"
}

output "database_endpoint" {
  description = "RDS endpoint - use this (with var.db_name/var.db_username/var.db_password) to run `npx medusa db:migrate` and create the first admin user (docs/DEPLOYMENT.md §5)."
  value       = aws_db_instance.main.address
  sensitive   = true
}

output "redis_endpoint" {
  value     = aws_elasticache_cluster.main.cache_nodes[0].address
  sensitive = true
}

output "product_images_bucket" {
  value = aws_s3_bucket.product_images.bucket
}

output "route53_name_servers" {
  description = "If create_hosted_zone is true, point your domain registrar at these name servers to actually make this zone authoritative."
  value       = var.create_hosted_zone ? aws_route53_zone.main[0].name_servers : []
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecr_repository_urls" {
  description = "Push your four built images here (docker tag/push) - see infra/terraform/README.md's exact commands. Each defaults into its matching task definition automatically (main.tf's coalesce()) unless you override backend_image/storefront_image/seller_portal_image/admin_image."
  value = {
    backend       = aws_ecr_repository.backend.repository_url
    storefront    = aws_ecr_repository.storefront.repository_url
    seller_portal = aws_ecr_repository.seller_portal.repository_url
    admin         = aws_ecr_repository.admin.repository_url
  }
}

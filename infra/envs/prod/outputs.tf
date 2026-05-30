output "alb_dns_name" {
  value = module.stack.alb_dns_name
}

output "db_endpoint" {
  value = module.stack.db_endpoint
}

output "db_url_secret_arn" {
  value = module.stack.db_url_secret_arn
}

output "bucket_id" {
  value = module.stack.bucket_id
}

output "cluster_name" {
  value = module.stack.cluster_name
}

output "app_secret_arns" {
  value = module.stack.app_secret_arns
}

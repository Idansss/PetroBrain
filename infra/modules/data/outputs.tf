output "db_endpoint" {
  value = aws_db_instance.this.address
}

output "db_url_secret_arn" {
  value = aws_secretsmanager_secret.db_url.arn
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "redis_url" {
  description = "Base redis:// URL (db 0). Broker/result append /1 and /2."
  value       = "redis://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
}

output "bucket_id" {
  value = aws_s3_bucket.docs.id
}

output "bucket_arn" {
  value = aws_s3_bucket.docs.arn
}

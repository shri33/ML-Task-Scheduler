# =============================================================================
# ElastiCache Redis Configuration
# =============================================================================

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}"
  description = "ElastiCache subnet group for ${var.project_name}"
  subnet_ids  = module.vpc.private_subnets

  tags = local.tags
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "redis" {
  name_prefix = "${var.project_name}-redis-"
  family      = "redis7"
  description = "Redis parameter group for ${var.project_name}"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = local.tags

  lifecycle {
    create_before_destroy = true
  }
}

# ElastiCache Replication Group (Redis Cluster)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.project_name}-${var.environment}"
  description          = "Redis cluster for ${var.project_name}"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  num_cache_clusters   = var.redis_num_cache_clusters
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.elasticache.id]

  automatic_failover_enabled = var.redis_automatic_failover
  multi_az_enabled          = var.redis_automatic_failover

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  snapshot_retention_limit = var.environment == "prod" ? 7 : 1
  snapshot_window          = "04:00-05:00"
  maintenance_window       = "Mon:05:00-Mon:06:00"

  auto_minor_version_upgrade = true

  apply_immediately = var.environment != "prod"

  tags = merge(local.tags, {
    Name = "${var.project_name}-redis"
  })

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_logs.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }
}

# Redis Auth Token
resource "random_password" "redis_auth_token" {
  length  = 64
  special = false # Redis auth token doesn't support special chars
}

# CloudWatch Log Group for Redis
resource "aws_cloudwatch_log_group" "redis_logs" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = local.tags
}

# Store credentials in Secrets Manager
resource "aws_secretsmanager_secret" "redis_credentials" {
  name_prefix = "${var.project_name}-redis-credentials-"
  description = "Redis credentials for ${var.project_name}"

  tags = local.tags
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    host              = aws_elasticache_replication_group.redis.primary_endpoint_address
    port              = 6379
    auth_token        = random_password.redis_auth_token.result
    connection_string = "rediss://:${random_password.redis_auth_token.result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  })
}

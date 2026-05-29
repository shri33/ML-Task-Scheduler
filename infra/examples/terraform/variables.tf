# =============================================================================
# Terraform Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ml-scheduler"
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway (cost savings for non-prod)"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# EKS Cluster
# -----------------------------------------------------------------------------

variable "cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.29"
}

variable "cluster_endpoint_public_access" {
  description = "Enable public access to cluster endpoint"
  type        = bool
  default     = true
}

variable "cluster_endpoint_private_access" {
  description = "Enable private access to cluster endpoint"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Node Groups
# -----------------------------------------------------------------------------

variable "node_instance_types" {
  description = "Instance types for general node group"
  type        = list(string)
  default     = ["t3.large", "t3a.large"]
}

variable "node_desired_size" {
  description = "Desired number of nodes in general node group"
  type        = number
  default     = 3
}

variable "node_min_size" {
  description = "Minimum number of nodes in general node group"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum number of nodes in general node group"
  type        = number
  default     = 10
}

variable "ml_node_instance_types" {
  description = "Instance types for ML workload node group"
  type        = list(string)
  default     = ["c5.xlarge", "c5a.xlarge", "c5.2xlarge"]
}

variable "ml_node_desired_size" {
  description = "Desired number of ML nodes"
  type        = number
  default     = 2
}

variable "ml_node_min_size" {
  description = "Minimum number of ML nodes"
  type        = number
  default     = 1
}

variable "ml_node_max_size" {
  description = "Maximum number of ML nodes"
  type        = number
  default     = 8
}

# -----------------------------------------------------------------------------
# Database (RDS)
# -----------------------------------------------------------------------------

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 50
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling"
  type        = number
  default     = 200
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "ml_scheduler"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "mlscheduler_admin"
  sensitive   = true
}

variable "db_password" {
  description = "Database master password (leave empty to generate)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

variable "db_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

# -----------------------------------------------------------------------------
# Redis (ElastiCache)
# -----------------------------------------------------------------------------

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters (nodes)"
  type        = number
  default     = 2
}

variable "redis_automatic_failover" {
  description = "Enable automatic failover"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logging"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

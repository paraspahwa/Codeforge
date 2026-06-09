variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "name_prefix" {
  type    = string
  default = "codeforge-staging"
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "certificate_arn" {
  type = string
}

variable "api_host_headers" {
  type = list(string)
}

variable "enable_ecs_services" {
  type    = bool
  default = false
}

variable "cluster_arn" {
  type    = string
  default = ""
}

variable "private_subnet_ids" {
  type    = list(string)
  default = []
}

variable "api_task_definition_arn" {
  type    = string
  default = ""
}

variable "web_task_definition_arn" {
  type    = string
  default = ""
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "web_desired_count" {
  type    = number
  default = 1
}

variable "worker_task_definition_arn" {
  type    = string
  default = ""
}

variable "worker_desired_count" {
  type    = number
  default = 1
}

variable "efs_file_system_id" {
  type    = string
  default = ""
}

variable "efs_security_group_id" {
  type        = string
  default     = ""
  description = "Optional existing EFS security group; module creates one when empty"
}

variable "api_service_name" {
  type    = string
  default = "codeforge-api-staging-service"
}

variable "web_service_name" {
  type    = string
  default = "codeforge-web-staging-service"
}

variable "worker_service_name" {
  type    = string
  default = "codeforge-worker-staging-service"
}

variable "enable_qdrant_service" {
  type    = bool
  default = false
}

variable "qdrant_task_definition_arn" {
  type    = string
  default = ""
}

variable "qdrant_desired_count" {
  type    = number
  default = 1
}

variable "qdrant_service_name" {
  type    = string
  default = "codeforge-qdrant-staging-service"
}

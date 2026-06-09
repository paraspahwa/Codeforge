variable "name_prefix" {
  type = string
}

variable "service_name" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "task_definition_arn" {
  type = string
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "dns_namespace_name" {
  type        = string
  description = "Private DNS namespace for service discovery, e.g. codeforge-staging.local"
}

variable "discovery_service_name" {
  type    = string
  default = "qdrant"
}

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "edge" {
  source = "../../modules/edge"

  name_prefix        = var.name_prefix
  vpc_id             = var.vpc_id
  public_subnet_ids  = var.public_subnet_ids
  certificate_arn    = var.certificate_arn
  api_host_headers   = var.api_host_headers
  api_port           = 8000
  web_port           = 3000
}

output "alb_dns_name" {
  value = module.edge.alb_dns_name
}

output "api_target_group_arn" {
  value = module.edge.api_target_group_arn
}

output "web_target_group_arn" {
  value = module.edge.web_target_group_arn
}

output "api_service_name" {
  value = try(module.api_service[0].service_name, null)
}

output "web_service_name" {
  value = try(module.web_service[0].service_name, null)
}

output "worker_service_name" {
  value = try(module.worker_service[0].service_name, null)
}

output "efs_security_group_id" {
  value = try(module.efs_access[0].efs_security_group_id, null)
}

output "qdrant_service_name" {
  value = try(module.qdrant_service[0].service_name, null)
}

output "qdrant_url" {
  value = try(module.qdrant_service[0].qdrant_url, null)
}

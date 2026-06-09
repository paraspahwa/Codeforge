locals {
  qdrant_dns_namespace = "${var.name_prefix}.local"
}

module "qdrant_service" {
  count  = var.enable_ecs_services && var.enable_qdrant_service && var.qdrant_task_definition_arn != "" ? 1 : 0
  source = "../../modules/ecs-qdrant-service"

  name_prefix            = var.name_prefix
  service_name           = var.qdrant_service_name
  cluster_arn            = var.cluster_arn
  task_definition_arn    = var.qdrant_task_definition_arn
  desired_count          = var.qdrant_desired_count
  vpc_id                 = var.vpc_id
  private_subnet_ids     = var.private_subnet_ids
  dns_namespace_name     = local.qdrant_dns_namespace
  discovery_service_name = "qdrant"
}

module "qdrant_access" {
  count  = var.enable_ecs_services && var.enable_qdrant_service && length(module.qdrant_service) > 0 ? 1 : 0
  source = "../../modules/qdrant-access"

  name_prefix               = var.name_prefix
  vpc_id                    = var.vpc_id
  qdrant_security_group_id  = module.qdrant_service[0].task_security_group_id
  client_security_group_ids = compact([
    try(module.api_service[0].task_security_group_id, ""),
    try(module.worker_service[0].task_security_group_id, ""),
  ])
}

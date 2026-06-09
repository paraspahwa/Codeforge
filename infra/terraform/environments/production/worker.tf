module "worker_service" {
  count  = var.enable_ecs_services && var.worker_task_definition_arn != "" ? 1 : 0
  source = "../../modules/ecs-worker-service"

  name_prefix         = var.name_prefix
  service_name        = var.worker_service_name
  cluster_arn         = var.cluster_arn
  task_definition_arn = var.worker_task_definition_arn
  desired_count       = var.worker_desired_count
  vpc_id              = var.vpc_id
  private_subnet_ids  = var.private_subnet_ids
}

module "efs_access" {
  count  = var.enable_ecs_services && var.efs_file_system_id != "" && length(module.worker_service) > 0 ? 1 : 0
  source = "../../modules/efs-access"

  name_prefix               = var.name_prefix
  vpc_id                    = var.vpc_id
  efs_file_system_id        = var.efs_file_system_id
  efs_security_group_id     = var.efs_security_group_id
  worker_security_group_ids = [module.worker_service[0].task_security_group_id]
}

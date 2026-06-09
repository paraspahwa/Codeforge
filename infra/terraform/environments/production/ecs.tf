module "api_service" {
  count  = var.enable_ecs_services ? 1 : 0
  source = "../../modules/ecs-service"

  name_prefix           = var.name_prefix
  service_name          = var.api_service_name
  cluster_arn           = var.cluster_arn
  task_definition_arn   = var.api_task_definition_arn
  desired_count         = var.api_desired_count
  container_name        = "codeforge-api"
  container_port        = 8000
  vpc_id                = var.vpc_id
  private_subnet_ids    = var.private_subnet_ids
  target_group_arn      = module.edge.api_target_group_arn
  alb_security_group_id = module.edge.alb_security_group_id
}

module "web_service" {
  count  = var.enable_ecs_services ? 1 : 0
  source = "../../modules/ecs-service"

  name_prefix           = var.name_prefix
  service_name          = var.web_service_name
  cluster_arn           = var.cluster_arn
  task_definition_arn   = var.web_task_definition_arn
  desired_count         = var.web_desired_count
  container_name        = "codeforge-web"
  container_port        = 3000
  vpc_id                = var.vpc_id
  private_subnet_ids    = var.private_subnet_ids
  target_group_arn      = module.edge.web_target_group_arn
  alb_security_group_id = module.edge.alb_security_group_id
}

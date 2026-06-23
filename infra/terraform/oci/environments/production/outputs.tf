output "load_balancer_ip" {
  value = module.edge.load_balancer_ip_addresses
}

output "api_service_name" {
  value = try(module.api_service[0].container_instance_display_name, null)
}

output "web_service_name" {
  value = try(module.web_service[0].container_instance_display_name, null)
}

output "worker_service_name" {
  value = try(module.worker_service[0].container_instance_display_name, null)
}

output "api_nsg_id" {
  value = try(module.api_service[0].task_nsg_id, null)
}

output "web_nsg_id" {
  value = try(module.web_service[0].task_nsg_id, null)
}

output "worker_nsg_id" {
  value = try(module.worker_service[0].task_nsg_id, null)
}

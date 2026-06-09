output "service_name" {
  value = aws_ecs_service.this.name
}

output "task_security_group_id" {
  value = aws_security_group.tasks.id
}

output "qdrant_url" {
  value = "http://${var.discovery_service_name}.${var.dns_namespace_name}:6333"
}

output "dns_namespace_id" {
  value = aws_service_discovery_private_dns_namespace.this.id
}

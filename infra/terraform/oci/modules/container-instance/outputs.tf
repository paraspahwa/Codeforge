output "container_instance_id" {
  value = oci_container_instances_container_instance.this.id
}

output "container_instance_display_name" {
  value = oci_container_instances_container_instance.this.display_name
}

output "task_nsg_id" {
  value = oci_core_network_security_group.tasks.id
}

output "private_ip" {
  value = try(oci_container_instances_container_instance.this.vnics[0].private_ip, null)
}

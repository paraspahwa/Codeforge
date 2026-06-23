output "load_balancer_id" {
  value = oci_load_balancer_load_balancer.this.id
}

output "load_balancer_ip_addresses" {
  value = oci_load_balancer_load_balancer.this.ip_address_details[*].ip_address
}

output "api_backend_set_name" {
  value = oci_load_balancer_backend_set.api.name
}

output "web_backend_set_name" {
  value = oci_load_balancer_backend_set.web.name
}

output "lb_nsg_id" {
  value = oci_core_network_security_group.lb.id
}

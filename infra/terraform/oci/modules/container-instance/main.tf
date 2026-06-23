terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0"
    }
  }
}

resource "oci_core_network_security_group" "tasks" {
  compartment_id = var.compartment_id
  vcn_id         = var.vcn_id
  display_name   = "${var.name_prefix}-${var.service_name}-nsg"
}

resource "oci_core_network_security_group_security_rule" "ingress_from_lb" {
  network_security_group_id = oci_core_network_security_group.tasks.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source_type               = "NSG"
  source                    = var.lb_nsg_id
  description               = "From load balancer"

  tcp_options {
    destination_port_range {
      min = var.container_port
      max = var.container_port
    }
  }
}

resource "oci_core_network_security_group_security_rule" "egress_all" {
  network_security_group_id = oci_core_network_security_group.tasks.id
  direction                 = "EGRESS"
  protocol                  = "all"
  source_type               = "CIDR_BLOCK"
  source                    = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  destination               = "0.0.0.0/0"
}

resource "oci_container_instances_container_instance" "this" {
  compartment_id      = var.compartment_id
  display_name        = "${var.name_prefix}-${var.service_name}"
  availability_domain = var.availability_domain
  shape               = var.shape
  shape_config {
    ocpus         = var.ocpus
    memory_in_gbs = var.memory_in_gbs
  }
  container_restart_policy = var.restart_policy

  vnics {
    display_name  = "${var.name_prefix}-${var.service_name}-vnic"
    subnet_id     = var.subnet_id
    is_public_ip  = var.assign_public_ip
    nsg_ids       = [oci_core_network_security_group.tasks.id]
  }

  dynamic "containers" {
    for_each = var.containers
    content {
      display_name     = containers.value.name
      image_url        = containers.value.image
      command          = containers.value.command
      environment_variables = containers.value.environment_variables
      is_resource_principal      = false

      resource_config {
        ocpus         = containers.value.ocpus != null ? containers.value.ocpus : var.ocpus
        memory_in_gbs = containers.value.memory != null ? containers.value.memory : var.memory_in_gbs
      }

      port {
        port        = containers.value.port
        protocol    = "TCP"
      }

      dynamic "volume_mounts" {
        for_each = containers.value.volume_mounts != null ? containers.value.volume_mounts : []
        content {
          mount_path = volume_mounts.value.mount_path
          volume_name = volume_mounts.value.volume_name
          sub_path    = volume_mounts.value.sub_path
        }
      }
    }
  }

  dynamic "volumes" {
    for_each = var.volumes
    content {
      name = volumes.value.name
      volume_type = volumes.value.type
      # For FSS-backed volumes
      configs {
        bind_mount_path = volumes.value.bind_mount_path
        file_system_id  = volumes.value.file_system_id
      }
    }
  }
}

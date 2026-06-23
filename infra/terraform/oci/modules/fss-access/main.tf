terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0"
    }
  }
}

resource "oci_core_network_security_group_security_rule" "nfs_from_workers" {
  for_each                  = toset(var.worker_nsg_ids)
  network_security_group_id = var.fss_nsg_id
  direction                 = "INGRESS"
  protocol                  = "6"
  source_type               = "NSG"
  source                    = each.value
  description               = "NFS from workers"

  tcp_options {
    destination_port_range {
      min = 2048
      max = 2050
    }
  }
}

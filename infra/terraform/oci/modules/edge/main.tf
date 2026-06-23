terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0"
    }
  }
}

resource "oci_core_network_security_group" "lb" {
  compartment_id = var.compartment_id
  vcn_id         = var.vcn_id
  display_name   = "${var.name_prefix}-lb-nsg"
}

resource "oci_core_network_security_group_security_rule" "https_ingress" {
  network_security_group_id = oci_core_network_security_group.lb.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source_type               = "CIDR_BLOCK"
  source                    = "0.0.0.0/0"
  description               = "HTTPS ingress"
  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_network_security_group_security_rule" "http_ingress" {
  network_security_group_id = oci_core_network_security_group.lb.id
  direction                 = "INGRESS"
  protocol                  = "6"
  source_type               = "CIDR_BLOCK"
  source                    = "0.0.0.0/0"
  description               = "HTTP redirect ingress"
  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

resource "oci_core_network_security_group_security_rule" "lb_egress" {
  network_security_group_id = oci_core_network_security_group.lb.id
  direction                 = "EGRESS"
  protocol                  = "all"
  source_type               = "CIDR_BLOCK"
  source                    = "0.0.0.0/0"
  destination_type          = "CIDR_BLOCK"
  destination               = "0.0.0.0/0"
}

resource "oci_load_balancer_load_balancer" "this" {
  compartment_id = var.compartment_id
  display_name   = "${var.name_prefix}-lb"
  shape          = var.lb_shape
  subnet_ids     = var.public_subnet_ids
  is_private     = false

  shape_details {
    minimum_bandwidth_in_mbps = var.lb_min_bandwidth
    maximum_bandwidth_in_mbps = var.lb_max_bandwidth
  }

  network_security_group_ids = [oci_core_network_security_group.lb.id]
}

resource "oci_load_balancer_backend_set" "api" {
  name             = "${var.name_prefix}-api-bes"
  load_balancer_id = oci_load_balancer_load_balancer.this.id
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol          = "HTTP"
    port              = var.api_port
    url_path          = "/health"
    interval_ms       = 30000
    healthy_threshold = 2
    unhealthy_threshold = 3
    timeout_in_millis = 5000
  }
}

resource "oci_load_balancer_backend_set" "web" {
  name             = "${var.name_prefix}-web-bes"
  load_balancer_id = oci_load_balancer_load_balancer.this.id
  policy           = "ROUND_ROBIN"

  health_checker {
    protocol          = "HTTP"
    port              = var.web_port
    url_path          = "/"
    interval_ms       = 30000
    healthy_threshold = 2
    unhealthy_threshold = 3
    timeout_in_millis = 5000
  }
}

resource "oci_load_balancer_listener" "https" {
  load_balancer_id         = oci_load_balancer_load_balancer.this.id
  name                     = "${var.name_prefix}-https-listener"
  default_backend_set_name = oci_load_balancer_backend_set.web.name
  port                     = 443
  protocol                 = "HTTP"
  ssl_configuration {
    certificate_name        = var.certificate_name
    verify_peer_certificate = false
  }
}

resource "oci_load_balancer_listener" "http" {
  load_balancer_id         = oci_load_balancer_load_balancer.this.id
  name                     = "${var.name_prefix}-http-listener"
  default_backend_set_name = oci_load_balancer_backend_set.web.name
  port                     = 80
  protocol                 = "HTTP"
}

resource "oci_load_balancer_hostname" "api" {
  load_balancer_id = oci_load_balancer_load_balancer.this.id
  name             = "${var.name_prefix}-api-hostname"
  hostname         = var.api_hostname
}

resource "oci_load_balancer_rule_set" "api_routing" {
  load_balancer_id = oci_load_balancer_load_balancer.this.id
  name             = "${var.name_prefix}-api-routing"

  items {
    action = "CONTROL_ACCESS_USING_HTTP_METHODS"
    allowed_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
    status_code = 405
  }
}

resource "oci_load_balancer_listener_rule" "api_forward" {
  listener_name    = oci_load_balancer_listener.https.name
  load_balancer_id = oci_load_balancer_load_balancer.this.id

  name     = "${var.name_prefix}-api-rule"
  condition_language = "URI_TEMPLATE"
  condition {
    attribute = "host-header"
    operator  = "EXACT_MATCH"
    value     = var.api_hostname
  }

  actions {
    type                  = "FORWARD_TO_BACKEND_SET"
    backend_set_name      = oci_load_balancer_backend_set.api.name
  }
}

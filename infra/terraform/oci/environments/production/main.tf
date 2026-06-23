terraform {
  required_version = ">= 1.5"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0"
    }
  }
}

provider "oci" {
  region = var.oci_region
}

module "edge" {
  source = "../../modules/edge"

  compartment_id   = var.compartment_id
  vcn_id          = var.vcn_id
  name_prefix     = var.name_prefix
  public_subnet_ids = var.public_subnet_ids
  certificate_name = var.certificate_name
  api_hostname    = var.api_hostname
  api_port        = 8000
  web_port        = 3000
}

module "api_service" {
  count  = var.enable_container_instances ? 1 : 0
  source = "../../modules/container-instance"

  compartment_id        = var.compartment_id
  vcn_id               = var.vcn_id
  name_prefix          = var.name_prefix
  service_name         = var.api_service_name
  subnet_id            = var.private_subnet_id
  availability_domain  = var.availability_domain
  lb_nsg_id            = module.edge.lb_nsg_id
  container_port       = 8000
  shape                = var.api_shape
  ocpus                = var.api_ocpus
  memory_in_gbs        = var.api_memory_gbs

  containers = [{
    name    = "codeforge-api"
    image   = var.api_image
    port    = 8000
    environment_variables = merge(var.shared_env_vars, var.api_env_vars)
  }]
}

module "web_service" {
  count  = var.enable_container_instances ? 1 : 0
  source = "../../modules/container-instance"

  compartment_id        = var.compartment_id
  vcn_id               = var.vcn_id
  name_prefix          = var.name_prefix
  service_name         = var.web_service_name
  subnet_id            = var.private_subnet_id
  availability_domain  = var.availability_domain
  lb_nsg_id            = module.edge.lb_nsg_id
  container_port       = 3000
  shape                = var.web_shape
  ocpus                = var.web_ocpus
  memory_in_gbs        = var.web_memory_gbs

  containers = [{
    name    = "codeforge-web"
    image   = var.web_image
    port    = 3000
    environment_variables = {
      NODE_ENV           = "production"
      NEXT_PUBLIC_API_BASE = var.web_api_base_url
    }
  }]
}

module "worker_service" {
  count  = var.enable_container_instances && var.enable_worker ? 1 : 0
  source = "../../modules/container-instance"

  compartment_id        = var.compartment_id
  vcn_id               = var.vcn_id
  name_prefix          = var.name_prefix
  service_name         = var.worker_service_name
  subnet_id            = var.private_subnet_id
  availability_domain  = var.availability_domain
  lb_nsg_id            = module.edge.lb_nsg_id
  container_port       = 8000
  shape                = var.worker_shape
  ocpus                = var.worker_ocpus
  memory_in_gbs        = var.worker_memory_gbs
  restart_policy       = "ON_FAILURE"

  containers = [{
    name    = "codeforge-worker"
    image   = var.worker_image
    port    = 8000
    command = ["celery", "-A", "app.celery_worker:celery_app", "worker", "--beat", "--loglevel=info"]
    environment_variables = merge(var.shared_env_vars, var.worker_env_vars)
    volume_mounts = var.enable_fss ? [{
      mount_path  = "/workspaces"
      volume_name = "codeforge-workspaces"
    }] : []
  }]

  volumes = var.enable_fss ? [{
    name           = "codeforge-workspaces"
    type           = "file_system"
    bind_mount_path = "/workspaces"
    file_system_id  = var.fss_file_system_id
  }] : []
}

module "fss_access" {
  count  = var.enable_container_instances && var.enable_fss && var.fss_nsg_id != "" ? 1 : 0
  source = "../../modules/fss-access"

  name_prefix    = var.name_prefix
  fss_nsg_id     = var.fss_nsg_id
  worker_nsg_ids = try([module.worker_service[0].task_nsg_id], [])
}

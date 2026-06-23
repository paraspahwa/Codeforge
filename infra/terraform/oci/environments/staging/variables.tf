variable "oci_region" {
  type    = string
  default = "ap-mumbai-1"
}

variable "compartment_id" { type = string }
variable "vcn_id" { type = string }
variable "name_prefix" {
  type    = string
  default = "codeforge-staging"
}
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_id" { type = string }
variable "availability_domain" { type = string }
variable "certificate_name" { type = string }
variable "api_hostname" { type = string }

variable "api_image" { type = string }
variable "web_image" { type = string }
variable "worker_image" { type = string }

variable "enable_container_instances" { type = bool, default = false }
variable "api_shape" { type = string, default = "CI.Standard.E4.Flex" }
variable "api_ocpus" { type = number, default = 1 }
variable "api_memory_gbs" { type = number, default = 2 }
variable "web_shape" { type = string, default = "CI.Standard.E4.Flex" }
variable "web_ocpus" { type = number, default = 1 }
variable "web_memory_gbs" { type = number, default = 2 }
variable "worker_shape" { type = string, default = "CI.Standard.E4.Flex" }
variable "worker_ocpus" { type = number, default = 1 }
variable "worker_memory_gbs" { type = number, default = 4 }

variable "enable_worker" { type = bool, default = true }
variable "enable_fss" { type = bool, default = false }
variable "fss_file_system_id" { type = string, default = "" }
variable "fss_nsg_id" { type = string, default = "" }
variable "api_service_name" { type = string, default = "codeforge-api" }
variable "web_service_name" { type = string, default = "codeforge-web" }
variable "worker_service_name" { type = string, default = "codeforge-worker" }

variable "shared_env_vars" { type = map(string), default = {} }
variable "api_env_vars" { type = map(string), default = {} }
variable "worker_env_vars" { type = map(string), default = {} }
variable "web_api_base_url" { type = string, default = "https://api-staging.example.com" }

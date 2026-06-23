variable "compartment_id" { type = string }
variable "vcn_id" { type = string }
variable "name_prefix" { type = string }
variable "service_name" { type = string }
variable "subnet_id" { type = string }
variable "availability_domain" { type = string }
variable "lb_nsg_id" { type = string }
variable "container_port" { type = number }
variable "shape" { type = string, default = "CI.Standard.E4.Flex" }
variable "ocpus" { type = number, default = 1 }
variable "memory_in_gbs" { type = number, default = 2 }
variable "restart_policy" { type = string, default = "ALWAYS" }
variable "assign_public_ip" { type = bool, default = false }

variable "containers" {
  type = list(object({
    name                = string
    image               = string
    port                = number
    command             = optional(list(string))
    environment_variables = optional(map(string))
    ocpus               = optional(number)
    memory              = optional(number)
    volume_mounts = optional(list(object({
      mount_path  = string
      volume_name = string
      sub_path    = optional(string)
    })))
  }))
}

variable "volumes" {
  type = list(object({
    name           = string
    type           = string
    bind_mount_path = optional(string)
    file_system_id  = optional(string)
  }))
  default = []
}

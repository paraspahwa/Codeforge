variable "compartment_id" { type = string }
variable "vcn_id" { type = string }
variable "name_prefix" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "certificate_name" { type = string }
variable "api_hostname" { type = string }
variable "api_port" { type = number, default = 8000 }
variable "web_port" { type = number, default = 3000 }
variable "lb_shape" { type = string, default = "flexible" }
variable "lb_min_bandwidth" { type = number, default = 10 }
variable "lb_max_bandwidth" { type = number, default = 100 }

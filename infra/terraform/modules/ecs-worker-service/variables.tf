variable "name_prefix" {
  type = string
}

variable "service_name" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "task_definition_arn" {
  type = string
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "container_name" {
  type    = string
  default = "codeforge-worker"
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

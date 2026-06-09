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
  type        = string
  description = "Initial task definition ARN; CI may register new revisions"
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "container_name" {
  type = string
}

variable "container_port" {
  type = number
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "target_group_arn" {
  type = string
}

variable "alb_security_group_id" {
  type = string
}

variable "assign_public_ip" {
  type    = bool
  default = false
}

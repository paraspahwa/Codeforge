variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "qdrant_security_group_id" {
  type = string
}

variable "client_security_group_ids" {
  type        = list(string)
  description = "API/worker task security groups allowed to reach Qdrant HTTP API"
}

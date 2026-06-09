variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "efs_file_system_id" {
  type        = string
  description = "Existing EFS filesystem ID mounted by worker tasks"
}

variable "worker_security_group_ids" {
  type        = list(string)
  description = "ECS worker task security groups allowed to mount EFS over NFS"
}

variable "efs_security_group_id" {
  type        = string
  default     = ""
  description = "Optional existing EFS security group; created when empty"
}

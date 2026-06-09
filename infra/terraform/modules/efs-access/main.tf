terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_security_group" "efs" {
  count = var.efs_security_group_id == "" ? 1 : 0

  name        = "${var.name_prefix}-efs"
  description = "EFS NFS access for CodeForge worker mounts"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

locals {
  efs_security_group_id = var.efs_security_group_id != "" ? var.efs_security_group_id : aws_security_group.efs[0].id
}

resource "aws_security_group_rule" "nfs_from_workers" {
  for_each = toset(var.worker_security_group_ids)

  type                     = "ingress"
  from_port                = 2049
  to_port                  = 2049
  protocol                 = "tcp"
  security_group_id        = local.efs_security_group_id
  source_security_group_id = each.value
  description              = "NFS from ECS worker tasks"
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_security_group_rule" "http_from_clients" {
  for_each = toset(var.client_security_group_ids)

  type                     = "ingress"
  from_port                = 6333
  to_port                  = 6333
  protocol                 = "tcp"
  security_group_id        = var.qdrant_security_group_id
  source_security_group_id = each.value
  description              = "Qdrant HTTP from ECS clients"
}

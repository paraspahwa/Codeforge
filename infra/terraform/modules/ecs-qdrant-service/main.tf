terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_security_group" "tasks" {
  name        = "${var.name_prefix}-${var.service_name}-tasks"
  description = "ECS Qdrant tasks for ${var.service_name}"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_service_discovery_private_dns_namespace" "this" {
  name        = var.dns_namespace_name
  description = "CodeForge private DNS for ${var.name_prefix}"
  vpc         = var.vpc_id
}

resource "aws_service_discovery_service" "qdrant" {
  name = var.discovery_service_name

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.this.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

resource "aws_ecs_service" "this" {
  name            = var.service_name
  cluster         = var.cluster_arn
  task_definition = var.task_definition_arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.qdrant.arn
  }

  lifecycle {
    ignore_changes = [task_definition]
  }
}

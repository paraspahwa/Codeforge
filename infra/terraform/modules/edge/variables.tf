variable "name_prefix" {
  type        = string
  description = "Resource name prefix, e.g. codeforge-staging"
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS listener"
}

variable "api_port" {
  type    = number
  default = 8000
}

variable "web_port" {
  type    = number
  default = 3000
}

variable "allowed_cidr_blocks" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "api_host_headers" {
  type        = list(string)
  description = "Hostnames routed to the API target group, e.g. api-staging.example.com"
}

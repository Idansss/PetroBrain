variable "name" {
  description = "Resource name prefix, e.g. petrobrain-dev."
  type        = string
}

variable "cidr" {
  description = "VPC CIDR block."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones to span (>=2 for HA)."
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "Use one shared NAT gateway (cheaper, dev) instead of one per AZ (HA, prod)."
  type        = bool
  default     = false
}

variable "app_port" {
  description = "Container port the API listens on."
  type        = number
  default     = 8000
}

variable "tags" {
  description = "Tags applied to all resources."
  type        = map(string)
  default     = {}
}

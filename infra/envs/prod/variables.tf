variable "region" {
  type    = string
  default = "af-south-1"
}

variable "image" {
  description = "Container image URI for API + worker (ECR)."
  type        = string
}

variable "bucket_name" {
  description = "Globally-unique S3 document bucket name."
  type        = string
}

variable "certificate_arn" {
  description = "ACM cert ARN for HTTPS (required in prod)."
  type        = string
}

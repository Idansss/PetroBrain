terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in an S3 bucket with DynamoDB locking. Configure at init:
  #   terraform init -backend-config=backend.hcl
  # (bucket, key, region, dynamodb_table). See infra/RUNBOOK.md.
  backend "s3" {}
}

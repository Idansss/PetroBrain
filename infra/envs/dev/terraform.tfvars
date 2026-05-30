region = "af-south-1"

# Replace with your ECR image URI and a globally-unique bucket name.
image       = "ACCOUNT_ID.dkr.ecr.af-south-1.amazonaws.com/petrobrain:dev"
bucket_name = "petrobrain-docs-dev-CHANGE-ME"

# Dev runs HTTP-only behind the ALB. Supply an ACM cert ARN for HTTPS.
certificate_arn = ""

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Local state by default - fine for a first apply/experiment. Before a
  # real team uses this, switch to a remote backend (S3 + DynamoDB lock
  # table) so state isn't only on one operator's machine. Left as a
  # placeholder rather than configured here, since the bucket/table
  # themselves would need to exist before Terraform could use them.
  # backend "s3" {
  #   bucket         = "replace-with-a-real-terraform-state-bucket"
  #   key            = "bawi-shopping/production/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "replace-with-a-real-lock-table"
  #   encrypt        = true
  # }
}

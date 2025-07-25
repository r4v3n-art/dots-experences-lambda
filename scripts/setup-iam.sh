#!/bin/bash

# IAM Setup Script for Lambda
set -e

echo "🔧 Setting up IAM roles and policies for Lambda..."

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

echo "📋 Account ID: $ACCOUNT_ID"
echo "🌍 Region: $REGION"

# Create the execution policy
echo "📝 Creating Lambda execution policy..."
aws iam create-policy \
    --policy-name lambda-execution-policy \
    --policy-document file://lambda-execution-policy.json \
    --description "Policy for Lambda function execution" \
    2>/dev/null || echo "Policy already exists or error occurred"

# Get the policy ARN
POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/lambda-execution-policy"

# Create the execution role
echo "👤 Creating Lambda execution role..."
aws iam create-role \
    --role-name lambda-execution-role \
    --assume-role-policy-document file://lambda-trust-policy.json \
    --description "Role for Lambda function execution" \
    2>/dev/null || echo "Role already exists or error occurred"

# Attach the policy to the role
echo "🔗 Attaching policy to role..."
aws iam attach-role-policy \
    --role-name lambda-execution-role \
    --policy-arn $POLICY_ARN

echo "✅ IAM setup completed!"
echo "🎯 Role ARN: arn:aws:iam::$ACCOUNT_ID:role/lambda-execution-role"
echo ""
echo "📋 You can now run: ./deploy.sh" 
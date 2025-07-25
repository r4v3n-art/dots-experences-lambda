#!/bin/bash

# AWS Lambda Deployment Script
set -e

echo "🚀 Starting AWS Lambda deployment..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create one with your environment variables."
    exit 1
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf build/
mkdir -p build

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build deployment package
echo "📦 Building deployment package..."
npm run build

# Check if build was successful
if [ ! -f build/lambda-deployment-package.zip ]; then
    echo "❌ Build failed - deployment package not created"
    exit 1
fi

echo "✅ Build completed successfully!"
echo "📦 Deployment package size: $(du -h build/lambda-deployment-package.zip | cut -f1)"

# Function configuration
FUNCTION_NAME="composite-lambda-function"
RUNTIME="nodejs18.x"
HANDLER="index.handler"
TIMEOUT=300
MEMORY_SIZE=512

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME &> /dev/null; then
    echo "🔄 Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://build/lambda-deployment-package.zip
    
    echo "⚙️ Updating function configuration..."
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout $TIMEOUT \
        --memory-size $MEMORY_SIZE
else
    echo "🆕 Creating new Lambda function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY_SIZE \
        --zip-file fileb://build/lambda-deployment-package.zip \
        --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role
fi

echo "✅ Deployment completed successfully!"
echo "🔗 Function ARN: arn:aws:lambda:$(aws configure get region):$(aws sts get-caller-identity --query Account --output text):function:$FUNCTION_NAME"

# Set environment variables
echo "🔧 Setting environment variables..."
# Parse .env file and format for AWS CLI
ENV_VARS=""
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ $key =~ ^#.*$ ]] && continue
    [[ -z $key ]] && continue
    
    # Remove quotes from value if present
    value=$(echo "$value" | sed 's/^"//;s/"$//')
    
    # Add to environment variables string
    if [ -z "$ENV_VARS" ]; then
        ENV_VARS="$key=$value"
    else
        ENV_VARS="$ENV_VARS,$key=$value"
    fi
done < .env

if [ -n "$ENV_VARS" ]; then
    echo "📋 Setting environment variables: $(echo "$ENV_VARS" | tr ',' '\n' | wc -l) variables"
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --environment Variables="$ENV_VARS"
    echo "✅ Environment variables set successfully"
else
    echo "⚠️  No environment variables found in .env file"
fi

echo "🎉 Lambda function deployed and configured!"
echo ""
echo "📋 Next steps:"
echo "1. Set up CloudWatch Events/EventBridge for scheduling"
echo "2. Configure IAM roles and permissions"
echo "3. Test the function manually"
echo "4. Monitor logs in CloudWatch" 
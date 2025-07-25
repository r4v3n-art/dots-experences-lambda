#!/bin/bash

# CloudWatch Events Scheduling Script
set -e

FUNCTION_NAME="composite-lambda-function"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

echo "⏰ Setting up CloudWatch Events scheduling for Lambda..."

# Create EventBridge rule (runs every 5 minutes)
echo "📅 Creating EventBridge rule..."
aws events put-rule \
    --name "composite-lambda-schedule" \
    --schedule-expression "rate(5 minutes)" \
    --description "Triggers composite lambda function every 5 minutes" \
    --state ENABLED

# Create target for the rule
echo "🎯 Creating target for the rule..."
aws events put-targets \
    --rule "composite-lambda-schedule" \
    --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"

# Add permission for EventBridge to invoke Lambda
echo "🔐 Adding permission for EventBridge..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id "EventBridgeInvoke" \
    --action "lambda:InvokeFunction" \
    --principal "events.amazonaws.com" \
    --source-arn "arn:aws:events:$REGION:$ACCOUNT_ID:rule/composite-lambda-schedule"

echo "✅ Scheduling setup completed!"
echo "🕐 Function will run every 5 minutes"
echo "📊 Monitor execution in CloudWatch Logs: /aws/lambda/$FUNCTION_NAME" 
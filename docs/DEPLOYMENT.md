# AWS Lambda Deployment Guide

This guide will help you deploy the composite lambda function to AWS Lambda.

## Prerequisites

1. **AWS CLI installed and configured**
   ```bash
   # Install AWS CLI
   brew install awscli  # macOS
   # or download from https://aws.amazon.com/cli/
   
   # Configure AWS CLI
   aws configure
   ```

2. **Node.js and npm installed**
   ```bash
   # Check versions
   node --version
   npm --version
   ```

3. **Environment variables set up**
   - Create a `.env` file with all required variables
   - See the existing `.env` file for reference

## Deployment Steps

### Step 1: Set up IAM Roles and Policies

```bash
./setup-iam.sh
```

This creates:
- Lambda execution policy
- Lambda execution role
- Attaches policy to role

### Step 2: Deploy the Lambda Function

```bash
./deploy.sh
```

This will:
- Install dependencies
- Build the deployment package
- Create or update the Lambda function
- Set environment variables

### Step 3: Set up Scheduling (Optional)

```bash
./create-schedule.sh
```

This creates a CloudWatch Events rule that runs the function every 5 minutes.

## Manual Deployment (Alternative)

If you prefer to deploy manually:

### 1. Build the deployment package

```bash
npm run build
```

### 2. Create the Lambda function

```bash
aws lambda create-function \
  --function-name composite-lambda-function \
  --runtime nodejs18.x \
  --handler index.handler \
  --timeout 300 \
  --memory-size 512 \
  --zip-file fileb://build/lambda-deployment-package.zip \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role
```

### 3. Set environment variables

```bash
aws lambda update-function-configuration \
  --function-name composite-lambda-function \
  --environment Variables="KEY1=value1,KEY2=value2"
```

## Configuration Options

### Function Settings

- **Runtime**: Node.js 18.x
- **Handler**: `index.handler`
- **Timeout**: 300 seconds (5 minutes)
- **Memory**: 512 MB
- **Architecture**: x86_64

### Scheduling Options

You can modify the schedule in `create-schedule.sh`:

- **Every 5 minutes**: `rate(5 minutes)`
- **Every hour**: `rate(1 hour)`
- **Daily at 2 AM**: `cron(0 2 * * ? *)`
- **Every 15 minutes**: `rate(15 minutes)`

## Monitoring and Logs

### View Logs

```bash
# Get recent logs
aws logs describe-log-streams \
  --log-group-name /aws/lambda/composite-lambda-function \
  --order-by LastEventTime \
  --descending

# Get specific log events
aws logs get-log-events \
  --log-group-name /aws/lambda/composite-lambda-function \
  --log-stream-name STREAM_NAME
```

### CloudWatch Dashboard

Create a CloudWatch dashboard to monitor:
- Function invocations
- Duration
- Errors
- Throttles

## Troubleshooting

### Common Issues

1. **"Role not found" error**
   - Run `./setup-iam.sh` first

2. **"Handler not found" error**
   - Check that `index.handler` exists in your code
   - Verify the deployment package includes `index.js`

3. **Timeout errors**
   - Increase the timeout in the function configuration
   - Check if the function is doing too much work

4. **Memory errors**
   - Increase the memory allocation
   - Optimize the code to use less memory

5. **Environment variable issues**
   - Verify all required variables are set
   - Check the format (no spaces around `=`)

### Testing Locally

```bash
# Test the function locally
npm start
```

### Manual Invocation

```bash
# Invoke the function manually
aws lambda invoke \
  --function-name composite-lambda-function \
  --payload '{}' \
  response.json
```

## Cost Optimization

- **Memory**: Start with 512MB, adjust based on performance
- **Timeout**: Set to minimum required (300 seconds should be sufficient)
- **Scheduling**: Consider running less frequently if real-time updates aren't needed

## Security Considerations

- Environment variables are encrypted at rest
- IAM roles follow least privilege principle
- Private keys should be stored securely
- Consider using AWS Secrets Manager for sensitive data

## Cleanup

To remove the deployed resources:

```bash
# Delete the Lambda function
aws lambda delete-function --function-name composite-lambda-function

# Delete the EventBridge rule
aws events remove-targets --rule composite-lambda-schedule --ids 1
aws events delete-rule --name composite-lambda-schedule

# Delete IAM role and policy
aws iam detach-role-policy --role-name lambda-execution-role --policy-arn arn:aws:iam::ACCOUNT_ID:policy/lambda-execution-policy
aws iam delete-role --role-name lambda-execution-role
aws iam delete-policy --policy-arn arn:aws:iam::ACCOUNT_ID:policy/lambda-execution-policy
``` 
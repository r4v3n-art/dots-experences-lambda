# Lambda Monitoring System

This monitoring system provides comprehensive tracking of your AWS Lambda function's performance, errors, and costs.

## 📊 **Monitoring Scripts**

### 1. **Full Monitoring Dashboard** (`monitor-lambda.js`)
- **Purpose**: Comprehensive monitoring with colored output
- **Usage**: `node monitor-lambda.js`
- **Output**: Console display with detailed metrics

**Features:**
- ✅ Function information and status
- 📊 Invocation metrics (last 24 hours)
- 🔍 Error analysis with recent error details
- 💰 Cost estimation
- 🔧 Environment variable status
- 📋 Recent log streams

### 2. **Simple Monitoring Report** (`monitor-lambda-simple.js`)
- **Purpose**: Basic metrics for automated monitoring
- **Usage**: `node monitor-lambda-simple.js`
- **Output**: `lambda-monitoring-report.txt`

**Features:**
- 📊 Basic metrics (invocations, errors, duration, throttles)
- 📈 Success rate calculation
- 💰 Cost analysis
- 🚨 Recent error details
- 📋 Summary with warnings

## 🚨 **Alert System**

### Alert Thresholds
- **Errors**: > 5 errors in 24 hours
- **Success Rate**: < 95%
- **Throttles**: Any throttles detected

### Alert Script (`alert-check.sh`)
- **Purpose**: Check for alert conditions
- **Usage**: `./alert-check.sh`
- **Schedule**: Every 15 minutes via cron

## ⏰ **Automated Monitoring Schedule**

| Schedule | Script | Purpose |
|----------|--------|---------|
| Every hour | `monitor-lambda-simple.js` | Basic metrics tracking |
| Every 15 minutes | `alert-check.sh` | Alert monitoring |
| Daily at 9 AM | `monitor-lambda.js` | Comprehensive daily report |
| Daily at 2 AM | `cleanup-reports.sh` | Cleanup old reports |

## 📁 **Output Files**

### Reports
- **`lambda-monitoring-report.txt`**: Hourly basic report
- **`daily-summary-YYYYMMDD.txt`**: Daily comprehensive report

### Monitoring Directory
```
monitoring/
├── lambda-monitoring-report.txt
├── daily-summary-20241201.txt
├── alert-check.sh
└── cleanup-reports.sh
```

## 🔧 **Setup Instructions**

### 1. **Install Monitoring System**
```bash
./setup-monitoring.sh
```

### 2. **Manual Monitoring**
```bash
# Full dashboard
node monitor-lambda.js

# Basic report
node monitor-lambda-simple.js

# Check alerts
./monitoring/alert-check.sh
```

### 3. **View Cron Jobs**
```bash
crontab -l
```

### 4. **Edit Cron Jobs**
```bash
crontab -e
```

## 📊 **Metrics Tracked**

### Basic Metrics
- **Invocations**: Number of function calls
- **Errors**: Number of failed executions
- **Duration**: Total execution time
- **Throttles**: Number of throttled requests
- **Success Rate**: Percentage of successful executions

### Cost Metrics
- **Request Cost**: Cost per invocation
- **Compute Cost**: Cost based on execution time and memory
- **Total Cost**: Combined cost for the period

### Error Analysis
- **Error Count**: Total errors in last 24 hours
- **Recent Errors**: Last 5 error messages with timestamps
- **Error Patterns**: Common error types and frequencies

## 🚨 **Alert Configuration**

### Customize Alert Thresholds
Edit `monitoring/alert-check.sh`:

```bash
ALERT_THRESHOLD_ERRORS=5        # Alert if > 5 errors
ALERT_THRESHOLD_SUCCESS_RATE=95 # Alert if < 95% success rate
```

### Add Notifications
Add to `alert-check.sh`:

```bash
# Email notification
echo "Lambda Alert: $alert" | mail -s "Lambda Alert" your@email.com

# Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Lambda Alert: $alert"}' \
  YOUR_SLACK_WEBHOOK_URL
```

## 📈 **Sample Output**

### Basic Report
```
[2024-12-01T10:00:00.000Z] === AWS Lambda Monitoring Report ===
[2024-12-01T10:00:00.000Z] Function: composite-lambda-function
[2024-12-01T10:00:00.000Z] Report generated: 12/1/2024, 10:00:00 AM
[2024-12-01T10:00:00.000Z] 
[2024-12-01T10:00:00.000Z] --- Basic Metrics (Last 24 Hours) ---
[2024-12-01T10:00:00.000Z] Invocations: 288
[2024-12-01T10:00:00.000Z] Errors: 2
[2024-12-01T10:00:00.000Z] Duration: 45.2s
[2024-12-01T10:00:00.000Z] Throttles: 0
[2024-12-01T10:00:00.000Z] Success Rate: 99.31%
[2024-12-01T10:00:00.000Z] 
[2024-12-01T10:00:00.000Z] --- Cost Analysis (Last 24 Hours) ---
[2024-12-01T10:00:00.000Z] Request Cost: $0.000058
[2024-12-01T10:00:00.000Z] Compute Cost: $0.000377
[2024-12-01T10:00:00.000Z] Total Cost: $0.000435
```

### Full Dashboard
```
============================================================
                AWS Lambda Monitoring Dashboard
============================================================

----------------------------------------
Function Information
----------------------------------------
📋 Function Name: composite-lambda-function
🔗 Function ARN: arn:aws:lambda:us-east-1:123456789012:function:composite-lambda-function
⏱️  Timeout: 300 seconds
💾 Memory: 512 MB
📦 Runtime: nodejs18.x
📅 Last Modified: 12/1/2024, 9:30:00 AM
📊 Code Size: 7.2 MB

----------------------------------------
Invocation Metrics (Last 24 Hours)
----------------------------------------
📊 Invocations: 288 total, 12.00 average per hour
📊 Errors: 2 total, 0.08 average per hour
⏱️  Duration: 45.2s average, 3.6m total
📊 Throttles: 0 total, 0.00 average per hour
```

## 🔍 **Troubleshooting**

### Common Issues

1. **"Function not found"**
   - Check AWS CLI configuration
   - Verify function name is correct
   - Ensure proper IAM permissions

2. **"No metrics available"**
   - Function may not have been invoked recently
   - Check CloudWatch metrics retention period
   - Verify function is deployed and active

3. **"Permission denied"**
   - Check IAM roles and policies
   - Verify AWS CLI credentials
   - Ensure CloudWatch Logs access

### Debug Commands
```bash
# Check AWS CLI configuration
aws configure list

# Test Lambda access
aws lambda get-function --function-name composite-lambda-function

# Check CloudWatch metrics
aws cloudwatch list-metrics --namespace AWS/Lambda

# View recent logs
aws logs describe-log-streams --log-group-name /aws/lambda/composite-lambda-function
```

## 📞 **Support**

For issues with the monitoring system:
1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Verify AWS CLI configuration
4. Check cron job status with `crontab -l`

## 🔄 **Maintenance**

### Regular Tasks
- **Weekly**: Review daily summaries for trends
- **Monthly**: Update cost thresholds if needed
- **Quarterly**: Review and adjust alert thresholds

### Cleanup
- Old reports are automatically cleaned up after 7 days
- Manual cleanup: `./monitoring/cleanup-reports.sh`
- Remove cron jobs: `crontab -r` (removes all cron jobs) 
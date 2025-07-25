#!/bin/bash

# Monitoring Setup Script
set -e

echo "🔧 Setting up Lambda monitoring..."

# Make scripts executable
chmod +x monitor-lambda.js
chmod +x monitor-lambda-simple.js

# Create monitoring directory
mkdir -p monitoring
cd monitoring

# Create cron job for hourly monitoring
echo "⏰ Setting up hourly monitoring cron job..."
(crontab -l 2>/dev/null; echo "0 * * * * cd $(pwd) && node ../monitor-lambda-simple.js") | crontab -

# Create daily summary cron job
echo "📅 Setting up daily summary cron job..."
(crontab -l 2>/dev/null; echo "0 9 * * * cd $(pwd) && node ../monitor-lambda.js > daily-summary-$(date +%Y%m%d).txt 2>&1") | crontab -

# Create alert script
cat > alert-check.sh << 'EOF'
#!/bin/bash

# Alert Check Script
REPORT_FILE="lambda-monitoring-report.txt"
ALERT_THRESHOLD_ERRORS=5
ALERT_THRESHOLD_SUCCESS_RATE=95

if [ ! -f "$REPORT_FILE" ]; then
    echo "❌ Monitoring report not found"
    exit 1
fi

# Extract metrics from report
ERRORS=$(grep "Errors:" "$REPORT_FILE" | awk '{print $2}' | sed 's/\.0$//')
SUCCESS_RATE=$(grep "Success Rate:" "$REPORT_FILE" | awk '{print $3}' | sed 's/%//')

# Check for alerts
ALERTS=()

if [ "$ERRORS" -gt "$ALERT_THRESHOLD_ERRORS" ]; then
    ALERTS+=("High error count: $ERRORS errors")
fi

if [ "$SUCCESS_RATE" -lt "$ALERT_THRESHOLD_SUCCESS_RATE" ]; then
    ALERTS+=("Low success rate: ${SUCCESS_RATE}%")
fi

# Send alerts if any
if [ ${#ALERTS[@]} -gt 0 ]; then
    echo "🚨 LAMBDA ALERTS DETECTED:"
    for alert in "${ALERTS[@]}"; do
        echo "  - $alert"
    done
    
    # You can add email/Slack notification here
    # Example: curl -X POST -H 'Content-type: application/json' --data '{"text":"Lambda Alert: ..."}' YOUR_SLACK_WEBHOOK
fi
EOF

chmod +x alert-check.sh

# Add alert check to cron (every 15 minutes)
echo "🚨 Setting up alert monitoring..."
(crontab -l 2>/dev/null; echo "*/15 * * * * cd $(pwd) && ./alert-check.sh") | crontab -

# Create cleanup script for old reports
cat > cleanup-reports.sh << 'EOF'
#!/bin/bash

# Cleanup old monitoring reports (keep last 7 days)
find . -name "daily-summary-*.txt" -mtime +7 -delete
find . -name "lambda-monitoring-report.txt" -mtime +1 -delete

echo "🧹 Cleaned up old monitoring reports"
EOF

chmod +x cleanup-reports.sh

# Add cleanup to cron (daily at 2 AM)
echo "🧹 Setting up cleanup job..."
(crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./cleanup-reports.sh") | crontab -

echo "✅ Monitoring setup completed!"
echo ""
echo "📋 Monitoring Schedule:"
echo "  • Hourly: Basic metrics and error tracking"
echo "  • Every 15 minutes: Alert checking"
echo "  • Daily at 9 AM: Comprehensive report"
echo "  • Daily at 2 AM: Cleanup old reports"
echo ""
echo "📁 Monitoring files:"
echo "  • Basic report: lambda-monitoring-report.txt"
echo "  • Daily summaries: daily-summary-YYYYMMDD.txt"
echo "  • Alert script: alert-check.sh"
echo ""
echo "🔧 To view current cron jobs: crontab -l"
echo "🔧 To edit cron jobs: crontab -e" 
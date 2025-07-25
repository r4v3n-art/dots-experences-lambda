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

#!/bin/bash

# Cleanup old monitoring reports (keep last 7 days)
find . -name "daily-summary-*.txt" -mtime +7 -delete
find . -name "lambda-monitoring-report.txt" -mtime +1 -delete

echo "🧹 Cleaned up old monitoring reports"

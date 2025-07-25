#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

console.log('🔍 Lambda Monitoring System Demo');
console.log('================================\n');

// Check if AWS CLI is available
try {
  const awsVersion = execSync('aws --version', { encoding: 'utf8' });
  console.log(`✅ AWS CLI available: ${awsVersion.trim()}`);
} catch (error) {
  console.log('❌ AWS CLI not available - monitoring will not work');
  console.log('   Install AWS CLI: https://aws.amazon.com/cli/');
  process.exit(1);
}

// Check if Lambda function exists
try {
  const functionInfo = execSync('aws lambda get-function --function-name composite-lambda-function', { encoding: 'utf8' });
  console.log('✅ Lambda function found and accessible');
} catch (error) {
  console.log('⚠️  Lambda function not found or not accessible');
  console.log('   Deploy the function first using: ./deploy.sh');
}

console.log('\n📊 Available Monitoring Scripts:');
console.log('================================');

console.log('\n1. 🎯 Full Monitoring Dashboard');
console.log('   Command: node monitor-lambda.js');
console.log('   Features:');
console.log('   • Colored console output');
console.log('   • Function information and status');
console.log('   • Invocation metrics (last 24 hours)');
console.log('   • Error analysis with recent details');
console.log('   • Cost estimation');
console.log('   • Environment variable status');
console.log('   • Recent log streams');

console.log('\n2. 📋 Simple Monitoring Report');
console.log('   Command: node monitor-lambda-simple.js');
console.log('   Features:');
console.log('   • Basic metrics (invocations, errors, duration, throttles)');
console.log('   • Success rate calculation');
console.log('   • Cost analysis');
console.log('   • Recent error details');
console.log('   • Summary with warnings');
console.log('   • Output to: lambda-monitoring-report.txt');

console.log('\n3. 🚨 Alert System');
console.log('   Command: ./monitoring/alert-check.sh');
console.log('   Features:');
console.log('   • Checks for alert conditions');
console.log('   • Configurable thresholds');
console.log('   • Can be integrated with email/Slack');

console.log('\n4. ⚙️  Automated Setup');
console.log('   Command: ./setup-monitoring.sh');
console.log('   Features:');
console.log('   • Sets up cron jobs for automated monitoring');
console.log('   • Hourly basic monitoring');
console.log('   • Daily comprehensive reports');
console.log('   • Alert checking every 15 minutes');
console.log('   • Automatic cleanup of old reports');

console.log('\n📈 Metrics Tracked:');
console.log('==================');
console.log('• Invocations: Number of function calls');
console.log('• Errors: Number of failed executions');
console.log('• Duration: Total execution time');
console.log('• Throttles: Number of throttled requests');
console.log('• Success Rate: Percentage of successful executions');
console.log('• Cost: Request cost + compute cost');

console.log('\n🚨 Alert Thresholds:');
console.log('===================');
console.log('• Errors: > 5 errors in 24 hours');
console.log('• Success Rate: < 95%');
console.log('• Throttles: Any throttles detected');

console.log('\n⏰ Monitoring Schedule:');
console.log('=====================');
console.log('• Every hour: Basic metrics tracking');
console.log('• Every 15 minutes: Alert checking');
console.log('• Daily at 9 AM: Comprehensive report');
console.log('• Daily at 2 AM: Cleanup old reports');

console.log('\n📁 Output Files:');
console.log('===============');
console.log('• lambda-monitoring-report.txt: Hourly basic report');
console.log('• daily-summary-YYYYMMDD.txt: Daily comprehensive report');
console.log('• monitoring/alert-check.sh: Alert checking script');

console.log('\n🔧 Quick Start:');
console.log('==============');
console.log('1. Deploy Lambda function: ./deploy.sh');
console.log('2. Setup monitoring: ./setup-monitoring.sh');
console.log('3. Test monitoring: node monitor-lambda-simple.js');
console.log('4. View full dashboard: node monitor-lambda.js');

console.log('\n📖 Documentation:');
console.log('================');
console.log('• Full documentation: MONITORING.md');
console.log('• Deployment guide: DEPLOYMENT.md');

// Show recent report if it exists
if (existsSync('lambda-monitoring-report.txt')) {
  console.log('\n📊 Recent Monitoring Report:');
  console.log('===========================');
  const report = readFileSync('lambda-monitoring-report.txt', 'utf8');
  const lines = report.split('\n').slice(0, 10); // Show first 10 lines
  lines.forEach(line => console.log(line));
  if (report.split('\n').length > 10) {
    console.log('... (truncated)');
  }
}

console.log('\n💡 Tips:');
console.log('=======');
console.log('• Run monitoring scripts regularly to track trends');
console.log('• Set up alerts for critical issues');
console.log('• Review daily summaries for performance patterns');
console.log('• Adjust alert thresholds based on your needs');
console.log('• Monitor costs to optimize function configuration');

console.log('\n🎉 Monitoring system is ready!'); 
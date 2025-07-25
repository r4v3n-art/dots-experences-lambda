#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const FUNCTION_NAME = 'composite-lambda-function';
const LOG_GROUP_NAME = `/aws/lambda/${FUNCTION_NAME}`;

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(60));
  log(message, 'bright');
  console.log('='.repeat(60));
}

function logSection(message) {
  console.log('\n' + '-'.repeat(40));
  log(message, 'cyan');
  console.log('-'.repeat(40));
}

function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    return null;
  }
}

function parseJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFunctionInfo() {
  logSection('Function Information');
  
  const functionInfo = executeCommand(`aws lambda get-function --function-name ${FUNCTION_NAME}`);
  if (!functionInfo) {
    log('❌ Function not found or access denied', 'red');
    return null;
  }
  
  const info = parseJSON(functionInfo);
  if (!info) {
    log('❌ Failed to parse function information', 'red');
    return null;
  }
  
  const config = info.Configuration;
  log(`📋 Function Name: ${config.FunctionName}`, 'green');
  log(`🔗 Function ARN: ${config.FunctionArn}`, 'green');
  log(`⏱️  Timeout: ${config.Timeout} seconds`, 'green');
  log(`💾 Memory: ${config.MemorySize} MB`, 'green');
  log(`📦 Runtime: ${config.Runtime}`, 'green');
  log(`📅 Last Modified: ${new Date(config.LastModified).toLocaleString()}`, 'green');
  log(`📊 Code Size: ${formatBytes(config.CodeSize)}`, 'green');
  
  return config;
}

function getInvocationMetrics() {
  logSection('Invocation Metrics (Last 24 Hours)');
  
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
  
  const metrics = [
    'Invocations',
    'Errors',
    'Duration',
    'Throttles'
  ];
  
  metrics.forEach(metric => {
    const command = `aws cloudwatch get-metric-statistics \
      --namespace AWS/Lambda \
      --metric-name ${metric} \
      --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
      --start-time ${startTime.toISOString()} \
      --end-time ${endTime.toISOString()} \
      --period 3600 \
      --statistics Sum`;
    
    const result = executeCommand(command);
    if (result) {
      const data = parseJSON(result);
      if (data && data.Datapoints && data.Datapoints.length > 0) {
        const total = data.Datapoints.reduce((sum, point) => sum + point.Sum, 0);
        const avg = data.Datapoints.reduce((sum, point) => sum + point.Average, 0) / data.Datapoints.length;
        
        if (metric === 'Duration') {
          log(`⏱️  ${metric}: ${formatDuration(avg)} average, ${formatDuration(total)} total`, 'green');
        } else {
          log(`📊 ${metric}: ${total.toFixed(0)} total, ${avg.toFixed(2)} average per hour`, 'green');
        }
      } else {
        log(`📊 ${metric}: No data available`, 'yellow');
      }
    } else {
      log(`📊 ${metric}: Failed to retrieve`, 'red');
    }
  });
}

function getRecentLogs() {
  logSection('Recent Log Streams');
  
  const command = `aws logs describe-log-streams \
    --log-group-name "${LOG_GROUP_NAME}" \
    --order-by LastEventTime \
    --descending \
    --max-items 5`;
  
  const result = executeCommand(command);
  if (!result) {
    log('❌ Failed to retrieve log streams', 'red');
    return [];
  }
  
  const data = parseJSON(result);
  if (!data || !data.logStreams) {
    log('❌ No log streams found', 'yellow');
    return [];
  }
  
  const streams = data.logStreams;
  log(`📋 Found ${streams.length} recent log streams:`, 'green');
  
  streams.forEach((stream, index) => {
    const lastEventTime = new Date(stream.lastEventTimestamp).toLocaleString();
    log(`  ${index + 1}. ${stream.logStreamName} (Last: ${lastEventTime})`, 'blue');
  });
  
  return streams;
}

function analyzeLogStream(streamName) {
  const command = `aws logs get-log-events \
    --log-group-name "${LOG_GROUP_NAME}" \
    --log-stream-name "${streamName}" \
    --start-from-head`;
  
  const result = executeCommand(command);
  if (!result) return null;
  
  const data = parseJSON(result);
  if (!data || !data.events) return null;
  
  return data.events;
}

function getErrorAnalysis() {
  logSection('Error Analysis (Last 24 Hours)');
  
  const streams = getRecentLogs();
  if (streams.length === 0) return;
  
  const allEvents = [];
  let processedStreams = 0;
  
  // Get events from recent streams
  streams.forEach(stream => {
    const events = analyzeLogStream(stream.logStreamName);
    if (events) {
      allEvents.push(...events);
      processedStreams++;
    }
  });
  
  if (allEvents.length === 0) {
    log('❌ No log events found', 'yellow');
    return;
  }
  
  log(`📊 Analyzed ${processedStreams} log streams with ${allEvents.length} total events`, 'green');
  
  // Filter events from last 24 hours
  const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
  const recentEvents = allEvents.filter(event => event.timestamp >= cutoffTime);
  
  if (recentEvents.length === 0) {
    log('❌ No events found in the last 24 hours', 'yellow');
    return;
  }
  
  // Analyze events
  const errors = recentEvents.filter(event => 
    event.message.includes('ERROR') || 
    event.message.includes('Error') || 
    event.message.includes('Exception') ||
    event.message.includes('Failed')
  );
  
  const successes = recentEvents.filter(event => 
    event.message.includes('completed') || 
    event.message.includes('successfully') ||
    event.message.includes('Success')
  );
  
  const warnings = recentEvents.filter(event => 
    event.message.includes('WARN') || 
    event.message.includes('Warning')
  );
  
  log(`✅ Successes: ${successes.length}`, 'green');
  log(`❌ Errors: ${errors.length}`, 'red');
  log(`⚠️  Warnings: ${warnings.length}`, 'yellow');
  log(`📊 Total Events: ${recentEvents.length}`, 'blue');
  
  // Show recent errors
  if (errors.length > 0) {
    log('\n🔍 Recent Errors:', 'red');
    errors.slice(0, 5).forEach((error, index) => {
      const time = new Date(error.timestamp).toLocaleString();
      log(`  ${index + 1}. [${time}] ${error.message.substring(0, 100)}...`, 'red');
    });
  }
  
  // Show recent successes
  if (successes.length > 0) {
    log('\n✅ Recent Successes:', 'green');
    successes.slice(0, 3).forEach((success, index) => {
      const time = new Date(success.timestamp).toLocaleString();
      log(`  ${index + 1}. [${time}] ${success.message.substring(0, 100)}...`, 'green');
    });
  }
}

function getFunctionStatus() {
  logSection('Function Status');
  
  const command = `aws lambda get-function --function-name ${FUNCTION_NAME}`;
  const result = executeCommand(command);
  
  if (!result) {
    log('❌ Function not accessible', 'red');
    return false;
  }
  
  const data = parseJSON(result);
  if (!data) {
    log('❌ Failed to parse function data', 'red');
    return false;
  }
  
  const state = data.Configuration.State;
  const lastUpdateStatus = data.Configuration.LastUpdateStatus;
  
  if (state === 'Active' && lastUpdateStatus === 'Successful') {
    log('✅ Function is active and ready', 'green');
    return true;
  } else {
    log(`⚠️  Function state: ${state}, Last update: ${lastUpdateStatus}`, 'yellow');
    return false;
  }
}

function getEnvironmentVariables() {
  logSection('Environment Variables');
  
  const command = `aws lambda get-function-configuration --function-name ${FUNCTION_NAME}`;
  const result = executeCommand(command);
  
  if (!result) {
    log('❌ Failed to retrieve function configuration', 'red');
    return;
  }
  
  const data = parseJSON(result);
  if (!data || !data.Environment || !data.Environment.Variables) {
    log('❌ No environment variables found', 'yellow');
    return;
  }
  
  const vars = data.Environment.Variables;
  const varCount = Object.keys(vars).length;
  
  log(`📋 Found ${varCount} environment variables:`, 'green');
  
  Object.keys(vars).forEach(key => {
    const value = vars[key];
    const displayValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') 
      ? '***HIDDEN***' 
      : value;
    log(`  ${key}: ${displayValue}`, 'blue');
  });
}

function getCostEstimate() {
  logSection('Cost Estimate (Last 24 Hours)');
  
  // Get invocation count
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
  
  const invocationsCommand = `aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
    --start-time ${startTime.toISOString()} \
    --end-time ${endTime.toISOString()} \
    --period 86400 \
    --statistics Sum`;
  
  const durationCommand = `aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
    --start-time ${startTime.toISOString()} \
    --end-time ${endTime.toISOString()} \
    --period 86400 \
    --statistics Sum`;
  
  const invocationsResult = executeCommand(invocationsCommand);
  const durationResult = executeCommand(durationCommand);
  
  if (!invocationsResult || !durationResult) {
    log('❌ Failed to retrieve cost metrics', 'red');
    return;
  }
  
  const invocationsData = parseJSON(invocationsResult);
  const durationData = parseJSON(durationResult);
  
  if (!invocationsData || !durationData) {
    log('❌ Failed to parse cost metrics', 'red');
    return;
  }
  
  const invocations = invocationsData.Datapoints?.[0]?.Sum || 0;
  const durationMs = durationData.Datapoints?.[0]?.Sum || 0;
  const durationSeconds = durationMs / 1000;
  
  // AWS Lambda pricing (as of 2024)
  const pricePerRequest = 0.0000002; // $0.20 per 1M requests
  const pricePerGBSecond = 0.0000166667; // $0.0000166667 per GB-second
  const memoryGB = 0.512; // 512MB = 0.512GB
  
  const requestCost = invocations * pricePerRequest;
  const computeCost = durationSeconds * memoryGB * pricePerGBSecond;
  const totalCost = requestCost + computeCost;
  
  log(`📊 Invocations: ${invocations.toFixed(0)}`, 'green');
  log(`⏱️  Total Duration: ${formatDuration(durationMs)}`, 'green');
  log(`💰 Request Cost: $${requestCost.toFixed(6)}`, 'green');
  log(`💰 Compute Cost: $${computeCost.toFixed(6)}`, 'green');
  log(`💰 Total Cost: $${totalCost.toFixed(6)}`, 'bright');
}

function main() {
  logHeader('AWS Lambda Monitoring Dashboard');
  
  // Check if AWS CLI is available
  const awsVersion = executeCommand('aws --version');
  if (!awsVersion) {
    log('❌ AWS CLI is not installed or not in PATH', 'red');
    log('Please install AWS CLI: https://aws.amazon.com/cli/', 'yellow');
    process.exit(1);
  }
  
  log(`🔧 AWS CLI Version: ${awsVersion.trim()}`, 'blue');
  
  // Check if function exists
  const functionExists = getFunctionStatus();
  if (!functionExists) {
    log('❌ Function is not accessible or not properly configured', 'red');
    process.exit(1);
  }
  
  // Get function information
  getFunctionInfo();
  
  // Get invocation metrics
  getInvocationMetrics();
  
  // Get error analysis
  getErrorAnalysis();
  
  // Get environment variables
  getEnvironmentVariables();
  
  // Get cost estimate
  getCostEstimate();
  
  logHeader('Monitoring Complete');
  log('💡 Tip: Run this script regularly to monitor your Lambda function health', 'cyan');
}

// Run the monitoring script
try {
  main();
} catch (error) {
  log(`❌ Monitoring script failed: ${error.message}`, 'red');
  process.exit(1);
} 
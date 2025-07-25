#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';

const FUNCTION_NAME = 'composite-lambda-function';
const LOG_GROUP_NAME = `/aws/lambda/${FUNCTION_NAME}`;
const OUTPUT_FILE = 'lambda-monitoring-report.txt';

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  appendFileSync(OUTPUT_FILE, logMessage + '\n');
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

function getBasicMetrics() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
  
  const metrics = {
    invocations: 0,
    errors: 0,
    duration: 0,
    throttles: 0
  };
  
  // Get invocations
  const invocationsCommand = `aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
    --start-time ${startTime.toISOString()} \
    --end-time ${endTime.toISOString()} \
    --period 86400 \
    --statistics Sum`;
  
  const invocationsResult = executeCommand(invocationsCommand);
  if (invocationsResult) {
    const data = parseJSON(invocationsResult);
    if (data && data.Datapoints && data.Datapoints.length > 0) {
      metrics.invocations = data.Datapoints[0].Sum || 0;
    }
  }
  
  // Get errors
  const errorsCommand = `aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
    --start-time ${startTime.toISOString()} \
    --end-time ${endTime.toISOString()} \
    --period 86400 \
    --statistics Sum`;
  
  const errorsResult = executeCommand(errorsCommand);
  if (errorsResult) {
    const data = parseJSON(errorsResult);
    if (data && data.Datapoints && data.Datapoints.length > 0) {
      metrics.errors = data.Datapoints[0].Sum || 0;
    }
  }
  
  // Get duration
  const durationCommand = `aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
    --start-time ${startTime.toISOString()} \
    --end-time ${endTime.toISOString()} \
    --period 86400 \
    --statistics Sum`;
  
  const durationResult = executeCommand(durationCommand);
  if (durationResult) {
    const data = parseJSON(durationResult);
    if (data && data.Datapoints && data.Datapoints.length > 0) {
      metrics.duration = data.Datapoints[0].Sum || 0;
    }
  }
  
  // Get throttles
  const throttlesCommand = `aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Throttles \
    --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
    --start-time ${startTime.toISOString()} \
    --end-time ${endTime.toISOString()} \
    --period 86400 \
    --statistics Sum`;
  
  const throttlesResult = executeCommand(throttlesCommand);
  if (throttlesResult) {
    const data = parseJSON(throttlesResult);
    if (data && data.Datapoints && data.Datapoints.length > 0) {
      metrics.throttles = data.Datapoints[0].Sum || 0;
    }
  }
  
  return metrics;
}

function getRecentErrors() {
  const command = `aws logs describe-log-streams \
    --log-group-name "${LOG_GROUP_NAME}" \
    --order-by LastEventTime \
    --descending \
    --max-items 3`;
  
  const result = executeCommand(command);
  if (!result) return [];
  
  const data = parseJSON(result);
  if (!data || !data.logStreams) return [];
  
  const errors = [];
  const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
  
  data.logStreams.forEach(stream => {
    const eventsCommand = `aws logs get-log-events \
      --log-group-name "${LOG_GROUP_NAME}" \
      --log-stream-name "${stream.logStreamName}" \
      --start-from-head`;
    
    const eventsResult = executeCommand(eventsCommand);
    if (eventsResult) {
      const eventsData = parseJSON(eventsResult);
      if (eventsData && eventsData.events) {
        eventsData.events.forEach(event => {
          if (event.timestamp >= cutoffTime && 
              (event.message.includes('ERROR') || 
               event.message.includes('Error') || 
               event.message.includes('Exception') ||
               event.message.includes('Failed'))) {
            errors.push({
              timestamp: new Date(event.timestamp).toISOString(),
              message: event.message.substring(0, 200)
            });
          }
        });
      }
    }
  });
  
  return errors.slice(0, 5); // Return only the 5 most recent errors
}

function calculateCost(metrics) {
  const invocations = metrics.invocations;
  const durationSeconds = metrics.duration / 1000;
  
  // AWS Lambda pricing (as of 2024)
  const pricePerRequest = 0.0000002; // $0.20 per 1M requests
  const pricePerGBSecond = 0.0000166667; // $0.0000166667 per GB-second
  const memoryGB = 0.512; // 512MB = 0.512GB
  
  const requestCost = invocations * pricePerRequest;
  const computeCost = durationSeconds * memoryGB * pricePerGBSecond;
  const totalCost = requestCost + computeCost;
  
  return {
    requestCost,
    computeCost,
    totalCost
  };
}

function generateReport() {
  // Clear the output file
  writeFileSync(OUTPUT_FILE, '');
  
  log('=== AWS Lambda Monitoring Report ===');
  log(`Function: ${FUNCTION_NAME}`);
  log(`Report generated: ${new Date().toLocaleString()}`);
  log('');
  
  // Get basic metrics
  log('--- Basic Metrics (Last 24 Hours) ---');
  const metrics = getBasicMetrics();
  
  log(`Invocations: ${metrics.invocations.toFixed(0)}`);
  log(`Errors: ${metrics.errors.toFixed(0)}`);
  log(`Duration: ${formatDuration(metrics.duration)}`);
  log(`Throttles: ${metrics.throttles.toFixed(0)}`);
  
  // Calculate success rate
  const successRate = metrics.invocations > 0 
    ? ((metrics.invocations - metrics.errors) / metrics.invocations * 100).toFixed(2)
    : 0;
  log(`Success Rate: ${successRate}%`);
  
  // Calculate cost
  log('');
  log('--- Cost Analysis (Last 24 Hours) ---');
  const cost = calculateCost(metrics);
  log(`Request Cost: $${cost.requestCost.toFixed(6)}`);
  log(`Compute Cost: $${cost.computeCost.toFixed(6)}`);
  log(`Total Cost: $${cost.totalCost.toFixed(6)}`);
  
  // Get recent errors
  log('');
  log('--- Recent Errors ---');
  const errors = getRecentErrors();
  if (errors.length > 0) {
    errors.forEach((error, index) => {
      log(`Error ${index + 1}: [${error.timestamp}] ${error.message}`);
    });
  } else {
    log('No errors found in the last 24 hours');
  }
  
  // Summary
  log('');
  log('--- Summary ---');
  if (metrics.errors > 0) {
    log(`⚠️  WARNING: ${metrics.errors} errors detected in the last 24 hours`);
  } else {
    log('✅ No errors detected in the last 24 hours');
  }
  
  if (metrics.throttles > 0) {
    log(`⚠️  WARNING: ${metrics.throttles} throttles detected`);
  }
  
  if (successRate < 95) {
    log(`⚠️  WARNING: Success rate is below 95% (${successRate}%)`);
  } else {
    log(`✅ Success rate is healthy (${successRate}%)`);
  }
  
  log('');
  log('=== End Report ===');
  
  console.log(`📊 Report saved to: ${OUTPUT_FILE}`);
}

// Run the monitoring script
try {
  generateReport();
} catch (error) {
  log(`❌ Monitoring script failed: ${error.message}`);
  process.exit(1);
} 
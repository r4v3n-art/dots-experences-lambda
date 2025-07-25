import { handler } from './index.js';

console.log('🧪 Testing Lambda function locally...');

// Test the handler
handler({})
  .then(result => {
    console.log('✅ Lambda function executed successfully!');
    console.log('Result:', result);
  })
  .catch(error => {
    console.error('❌ Lambda function failed:', error);
    process.exit(1);
  }); 
/**
 * Calculate exact token costs
 */
const fs = require('fs');
const path = require('path');

function loadContentFile(filename) {
  try {
    const filePath = path.join(__dirname, '..', 'data', 'content', filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

function loadProducts() {
  try {
    const filePath = path.join(__dirname, '..', 'data', 'products.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [];
  }
}

const instructions = loadContentFile('bot-instructions.md') || '';
const toneStyle = loadContentFile('tone-style.md');
const imageHandling = loadContentFile('image-handling.md');
const productRecognition = loadContentFile('product-recognition.md');
const purchaseFlow = loadContentFile('purchase-flow.md');
const deliveryCalculation = loadContentFile('delivery-calculation.md');
const contactPolicies = loadContentFile('contact-policies.md');
const services = loadContentFile('services.md');
const faqs = loadContentFile('faqs.md');
const delivery = loadContentFile('delivery-info.md');
const payment = loadContentFile('payment-info.md');

const products = loadProducts();
const productCatalog = products.map(p => {
  const hasImage = p.image && p.image !== 'IMAGE_URL_HERE' && p.image.startsWith('http');
  return `${p.name} (ID: ${p.id}) - Price: ${p.price} ${p.currency || 'GEL'}, Stock: ${p.stock}${hasImage ? ' [HAS_IMAGE]' : ''}`;
}).join('\n');

const fullPrompt = [
  instructions, toneStyle, imageHandling, productRecognition,
  purchaseFlow, deliveryCalculation, contactPolicies, services,
  faqs, delivery, payment, productCatalog
].join('\n');

console.log('=== SYSTEM PROMPT SIZE ===');
console.log('Characters:', fullPrompt.length);
console.log('Estimated input tokens (~4 chars/token):', Math.round(fullPrompt.length / 4));
console.log('');

console.log('=== REVISED COST CALCULATION ===');

const inputTokens = Math.round(fullPrompt.length / 4);
const outputTokens = 800; // Realistic for Georgian responses

// GPT-4-turbo pricing: $10/1M input, $30/1M output
const inputCost = inputTokens * 0.00001;
const outputCost = outputTokens * 0.00003;
const costPerCall = inputCost + outputCost;

console.log('Input tokens per call:', inputTokens);
console.log('Output tokens per call (estimate):', outputTokens);
console.log('Cost per call: $' + costPerCall.toFixed(4));
console.log('');

// Calls breakdown
const testSuccessful = 8; // 9 scenarios, 1 failed with 429
const prodBilled = 6;
const totalCalls = testSuccessful + prodBilled;

console.log('Test successful: ' + testSuccessful + ' x $' + costPerCall.toFixed(3) + ' = $' + (testSuccessful * costPerCall).toFixed(2));
console.log('Prod billed: ' + prodBilled + ' x $' + costPerCall.toFixed(3) + ' = $' + (prodBilled * costPerCall).toFixed(2));
console.log('TOTAL CALCULATED: $' + (totalCalls * costPerCall).toFixed(2));
console.log('');
console.log('ACTUAL SPENT: $2.42');
console.log('DIFFERENCE: $' + (2.42 - totalCalls * costPerCall).toFixed(2));

console.log('\n=== WHAT ACCOUNTS FOR $2.42? ===');
const callsNeeded = Math.ceil(2.42 / costPerCall);
console.log('Calls needed to reach $2.42:', callsNeeded);
console.log('Known calls: 14 (8 test + 6 prod)');
console.log('Mystery calls:', callsNeeded - 14);

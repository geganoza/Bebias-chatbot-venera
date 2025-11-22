/**
 * Test AI responses against MD file instructions
 * Run with: node scripts/test-ai-compliance.js
 */

const fs = require('fs');
const path = require('path');

// Load environment FIRST - prefer .env.prod (production) over .env.local
const envProdPath = path.join(__dirname, '..', '.env.prod');
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = fs.existsSync(envProdPath) ? envProdPath : envLocalPath;
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      let value = match[2].trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1].trim()] = value;
    }
  });
}

// Now require OpenAI after env is loaded
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load content files
function loadContentFile(filename) {
  try {
    const filePath = path.join(__dirname, '..', 'data', 'content', filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error loading ${filename}:`, error.message);
    return '';
  }
}

// Load products
function loadProducts() {
  try {
    const filePath = path.join(__dirname, '..', 'data', 'products.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error('Error loading products:', error.message);
    return [];
  }
}

// Build system prompt (same as process-message/route.ts)
function buildSystemPrompt() {
  const instructions = loadContentFile('bot-instructions.md') || 'You are VENERA, a helpful assistant.';
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

  // Build product catalog
  const products = loadProducts();
  const productCatalog = products.map(p => {
    const hasImage = p.image && p.image !== 'IMAGE_URL_HERE' && p.image.startsWith('http');
    return `${p.name} (ID: ${p.id}) - Price: ${p.price} ${p.currency || 'GEL'}, Stock: ${p.stock}${hasImage ? ' [HAS_IMAGE]' : ''}`;
  }).join('\n');

  // Get current Georgia time
  const georgiaTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tbilisi',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());

  return `${instructions}

## TONE & STYLE GUIDELINES
${toneStyle}

## IMAGE HANDLING
${imageHandling}

## PRODUCT RECOGNITION
${productRecognition}

## PURCHASE FLOW
${purchaseFlow}

## DELIVERY DATE CALCULATION
${deliveryCalculation}

## CONTACT & STORE POLICIES
${contactPolicies}

## SERVICES
${services}

## FREQUENTLY ASKED QUESTIONS
${faqs}

## DELIVERY PRICING
${delivery}

## PAYMENT INFORMATION
${payment}

## PRODUCT CATALOG
${productCatalog}

## CURRENT DATE/TIME
Georgia Time (GMT+4): ${georgiaTime}`.trim();
}

// Test scenarios
const testScenarios = [
  {
    name: 'Greeting (Georgian)',
    message: 'გამარჯობა',
    checks: [
      { rule: 'Should respond in Georgian', check: (r) => /[\u10A0-\u10FF]/.test(r) },
      { rule: 'Should be concise (under 150 words)', check: (r) => r.split(/\s+/).length < 150 },
      { rule: 'Should NOT use bold markdown **', check: (r) => !r.includes('**') },
    ]
  },
  {
    name: 'Product Inquiry - Orange Hat',
    message: 'სტაფილოსფერი ქუდი გაქვთ?',
    checks: [
      { rule: 'Should include SEND_IMAGE command', check: (r) => /SEND_IMAGE:/i.test(r) },
      { rule: 'Should mention price', check: (r) => /\d+/.test(r) && (r.includes('ლარი') || r.includes('GEL')) },
      { rule: 'Should be concise', check: (r) => r.split(/\s+/).length < 100 },
    ]
  },
  {
    name: 'Purchase Intent (Georgian)',
    message: 'მინდა წითელი ქუდის ყიდვა',
    checks: [
      { rule: 'Should include SEND_IMAGE command', check: (r) => /SEND_IMAGE:/i.test(r) },
      { rule: 'Should present delivery options', check: (r) => r.includes('თბილისი') || r.includes('რეგიონ') },
      { rule: 'Should NOT ask გსურთ შეკვეთა?', check: (r) => !r.includes('გსურთ შეკვეთა') },
      { rule: 'Should mention delivery price', check: (r) => r.includes('6') || r.includes('10') },
    ]
  },
  {
    name: 'Delivery Time Question',
    message: 'როდის მივიღებ თბილისში?',
    checks: [
      { rule: 'Should mention specific day name', check: (r) => /ორშაბათ|სამშაბათ|ოთხშაბათ|ხუთშაბათ|პარასკევ|შაბათ|კვირა/i.test(r) },
      { rule: 'Should NOT use generic "1-3 days"', check: (r) => !r.includes('1-3 სამუშაო დღე') },
    ]
  },
  {
    name: 'Store Visit Request',
    message: 'შეიძლება მაღაზიაში მოვიდე პროდუქტების სანახავად?',
    checks: [
      { rule: 'Should explain no physical store', check: (r) => r.includes('ფიზიკური მაღაზია') || r.includes('არ გვაქვს') },
      { rule: 'Should provide social media links', check: (r) => r.includes('instagram') || r.includes('facebook') || r.includes('bebias.ge') },
      { rule: 'Should NOT provide address', check: (r) => !r.includes('მისამართ') || r.includes('არ') },
    ]
  },
  {
    name: 'Phone Number Request',
    message: 'ტელეფონის ნომერი მომეცით',
    checks: [
      { rule: 'Should provide phone number when explicitly asked', check: (r) => r.includes('+995') || r.includes('577') },
    ]
  },
  {
    name: 'Photo Request',
    message: 'ფირუზისფერი ქუდის ფოტო გაქვთ?',
    checks: [
      { rule: 'Should include SEND_IMAGE command', check: (r) => /SEND_IMAGE:/i.test(r) },
      { rule: 'Should NOT say "cannot send photos"', check: (r) => !r.toLowerCase().includes('cannot send') && !r.includes('ვერ გავაგზავნი') },
      { rule: 'Should be positive about sending image', check: (r) => r.includes('აი') || r.includes('სურათი') || /SEND_IMAGE/i.test(r) },
    ]
  },
  {
    name: 'Multiple Products Question',
    message: 'რა ფერის ქუდები გაქვთ?',
    checks: [
      { rule: 'Should list multiple products', check: (r) => (r.match(/ქუდი|hat/gi) || []).length >= 2 || r.split('\n').length > 3 },
      { rule: 'Should include at least one SEND_IMAGE', check: (r) => /SEND_IMAGE:/i.test(r) },
    ]
  },
  {
    name: 'English Greeting',
    message: 'Hello, what products do you have?',
    checks: [
      { rule: 'Should respond in English', check: (r) => /[a-zA-Z]{5,}/.test(r) },
      { rule: 'Should mention products', check: (r) => r.toLowerCase().includes('hat') || r.toLowerCase().includes('sock') || r.toLowerCase().includes('product') },
    ]
  },
];

async function runTest(scenario, systemPrompt) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`TEST: ${scenario.name}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`📤 Message: "${scenario.message}"`);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: scenario.message }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || '';

    console.log(`\n📥 Response:`);
    console.log(`${'─'.repeat(40)}`);
    console.log(response);
    console.log(`${'─'.repeat(40)}`);

    // Run checks
    console.log(`\n📋 Compliance Checks:`);
    let passed = 0;
    let failed = 0;

    for (const check of scenario.checks) {
      const result = check.check(response);
      if (result) {
        console.log(`  ✅ ${check.rule}`);
        passed++;
      } else {
        console.log(`  ❌ ${check.rule}`);
        failed++;
      }
    }

    console.log(`\n📊 Result: ${passed}/${scenario.checks.length} checks passed`);
    return { passed, failed, total: scenario.checks.length };

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { passed: 0, failed: scenario.checks.length, total: scenario.checks.length, error: true };
  }
}

async function main() {
  console.log('🧪 AI Compliance Test Suite');
  console.log('Testing AI responses against MD file instructions\n');

  const systemPrompt = buildSystemPrompt();
  console.log(`📄 System prompt loaded (${systemPrompt.length} characters)`);

  let totalPassed = 0;
  let totalFailed = 0;
  let totalChecks = 0;

  for (const scenario of testScenarios) {
    const result = await runTest(scenario, systemPrompt);
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalChecks += result.total;

    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('FINAL SUMMARY');
  console.log(`${'═'.repeat(60)}`);
  console.log(`Total Tests: ${testScenarios.length}`);
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed: ${totalPassed} (${Math.round(totalPassed/totalChecks*100)}%)`);
  console.log(`Failed: ${totalFailed} (${Math.round(totalFailed/totalChecks*100)}%)`);
  console.log(`${'═'.repeat(60)}\n`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

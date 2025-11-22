/**
 * Test token usage estimation WITHOUT making OpenAI API calls
 * This simulates what process-message/route.ts sends to OpenAI
 */
const fs = require('fs');
const path = require('path');

// Load content files (same as process-message/route.ts)
function loadContentFile(filename) {
  try {
    const filePath = path.join(process.cwd(), 'data', 'content', filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

// Load products
function loadProducts() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'products.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [];
  }
}

// Filter products (same logic as process-message/route.ts)
function filterProductsByQuery(products, userMessage) {
  const message = userMessage.toLowerCase();
  const categoryKeywords = {
    'hat': ['ქუდ', 'შაპკა', 'hat', 'beanie', 'cap'],
    'sock': ['წინდ', 'sock', 'socks'],
    'scarf': ['შარფ', 'scarf', 'მოწნული'],
    'glove': ['ხელთათმან', 'glove', 'გლუვ'],
  };
  const colorKeywords = [
    'შავ', 'თეთრ', 'წითელ', 'ლურჯ', 'მწვანე', 'ყვითელ', 'ვარდისფერ', 'ნარინჯისფერ',
    'სტაფილოსფერ', 'ფირუზისფერ', 'იისფერ', 'ტყფისფერ', 'ნაცრისფერ', 'ცისფერ',
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'orange'
  ];

  let matchedProducts = [];

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => message.includes(kw))) {
      const categoryProducts = products.filter(p =>
        p.category?.toLowerCase().includes(category) ||
        p.name.toLowerCase().includes(category) ||
        keywords.some(kw => p.name.toLowerCase().includes(kw))
      );
      matchedProducts.push(...categoryProducts);
    }
  }

  const matchedColors = colorKeywords.filter(c => message.includes(c.toLowerCase()));
  if (matchedColors.length > 0) {
    const colorProducts = products.filter(p =>
      matchedColors.some(c => p.name.toLowerCase().includes(c.toLowerCase()) || p.id.toLowerCase().includes(c.toLowerCase()))
    );
    if (matchedProducts.length === 0) {
      matchedProducts = colorProducts;
    } else {
      matchedProducts = matchedProducts.filter(p => colorProducts.some(cp => cp.id === p.id));
    }
  }

  const uniqueProducts = Array.from(new Map(matchedProducts.map(p => [p.id, p])).values());

  if (uniqueProducts.length > 0) {
    return uniqueProducts.slice(0, 30);
  }

  // Fallback: bestsellers
  const productsWithImages = products.filter(p =>
    p.image && p.image !== 'IMAGE_URL_HERE' && !p.image.includes('facebook.com') && p.image.startsWith('http')
  );
  return productsWithImages.slice(0, 20);
}

function hasValidImage(p) {
  return p.image && p.image !== 'IMAGE_URL_HERE' && !p.image.includes('facebook.com') && p.image.startsWith('http');
}

// Test scenarios
const testQueries = [
  'გამარჯობა',  // Hello - no product match, will get bestsellers
  'შავი ქუდი გაქვთ?',  // Black hat - specific match
  'წითელი წინდები',  // Red socks - specific match
  'რა ფასი აქვს?',  // What's the price - no match, bestsellers
];

console.log('=== TOKEN ESTIMATION TEST ===\n');

// Load everything
const instructions = loadContentFile('bot-instructions.md');
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

const allProducts = loadProducts();

console.log('Content files loaded:');
console.log('  bot-instructions.md:', instructions.length, 'chars');
console.log('  tone-style.md:', toneStyle.length, 'chars');
console.log('  image-handling.md:', imageHandling.length, 'chars');
console.log('  product-recognition.md:', productRecognition.length, 'chars');
console.log('  purchase-flow.md:', purchaseFlow.length, 'chars');
console.log('  delivery-calculation.md:', deliveryCalculation.length, 'chars');
console.log('  contact-policies.md:', contactPolicies.length, 'chars');
console.log('  services.md:', services.length, 'chars');
console.log('  faqs.md:', faqs.length, 'chars');
console.log('  delivery-info.md:', delivery.length, 'chars');
console.log('  payment-info.md:', payment.length, 'chars');

const baseContentChars = instructions.length + toneStyle.length + imageHandling.length +
  productRecognition.length + purchaseFlow.length + deliveryCalculation.length +
  contactPolicies.length + services.length + faqs.length + delivery.length + payment.length;

console.log('\nBase content total:', baseContentChars.toLocaleString(), 'chars');
console.log('Total products:', allProducts.length);
console.log('\n' + '='.repeat(50));

for (const query of testQueries) {
  console.log('\nQuery: "' + query + '"');

  const filtered = filterProductsByQuery(allProducts, query);
  const productContext = filtered
    .map(p => {
      return p.name + ' (ID: ' + p.id + ') - Price: ' + p.price + ' ' + (p.currency || '') + ', Stock: ' + p.stock + ', Category: ' + (p.category || 'N/A') + (hasValidImage(p) ? ' [HAS_IMAGE]' : '');
    })
    .join('\n');

  const totalChars = baseContentChars + productContext.length;

  // Georgian text: ~1.5 chars per token
  // English text: ~4 chars per token
  // Mixed: ~2.5 chars per token (rough estimate)
  const estimatedTokens = Math.round(totalChars / 2.5);

  console.log('  Filtered products:', filtered.length);
  console.log('  Product context:', productContext.length, 'chars');
  console.log('  Total system prompt:', totalChars.toLocaleString(), 'chars');
  console.log('  Estimated tokens:', estimatedTokens.toLocaleString());
  console.log('  Estimated cost: $' + (estimatedTokens * 10 / 1000000).toFixed(4), '(input only)');
}

// Compare with OLD way (all products)
console.log('\n' + '='.repeat(50));
console.log('\nCOMPARISON WITH OLD APPROACH (ALL PRODUCTS):');
const allProductsContext = allProducts
  .map(p => {
    return p.name + ' (ID: ' + p.id + ') - Price: ' + p.price + ' ' + (p.currency || '') + ', Stock: ' + p.stock + ', Category: ' + (p.category || 'N/A') + (hasValidImage(p) ? ' [HAS_IMAGE]' : '');
  })
  .join('\n');

const oldTotalChars = baseContentChars + allProductsContext.length;
const oldEstimatedTokens = Math.round(oldTotalChars / 2.5);

console.log('  All products context:', allProductsContext.length.toLocaleString(), 'chars');
console.log('  OLD total system prompt:', oldTotalChars.toLocaleString(), 'chars');
console.log('  OLD estimated tokens:', oldEstimatedTokens.toLocaleString());
console.log('  OLD estimated cost: $' + (oldEstimatedTokens * 10 / 1000000).toFixed(4), '(input only)');

console.log('\n' + '='.repeat(50));
console.log('SAVINGS SUMMARY:');
const avgNewTokens = 8000; // rough average from filtered
const savings = oldEstimatedTokens - avgNewTokens;
console.log('  Token reduction: ~' + savings.toLocaleString(), 'tokens (~' + Math.round(savings/oldEstimatedTokens*100) + '%)');
console.log('  Cost reduction: ~$' + (savings * 10 / 1000000).toFixed(4), 'per request');
console.log('  For 19 requests: ~$' + (savings * 10 / 1000000 * 19).toFixed(2), 'saved');

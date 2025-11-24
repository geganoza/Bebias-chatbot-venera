#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Load products
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products.json'), 'utf8'));

// Copy of the filterProductsByQuery function
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
    'ყავისფერ', 'ყავის', 'მუქი', 'ღია',
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'orange',
    'turquoise', 'purple', 'brown', 'gray', 'grey'
  ];

  const materialKeywords = [
    'ბამბა', 'ბამბის', 'შალ', 'შალის', 'მატყლ',
    'cotton', 'wool', 'cashmere', 'knit'
  ];

  let matchedProducts = [];

  // Category matches
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

  console.log(`After category filter: ${matchedProducts.length} products`);

  // Color matches
  const matchedColors = colorKeywords.filter(c => message.includes(c.toLowerCase()));
  if (matchedColors.length > 0) {
    console.log(`Matched colors: ${matchedColors.join(', ')}`);
    const colorProducts = products.filter(p =>
      matchedColors.some(c => p.name.toLowerCase().includes(c.toLowerCase()) || p.id.toLowerCase().includes(c.toLowerCase()))
    );
    console.log(`Found ${colorProducts.length} products matching colors`);

    if (matchedProducts.length === 0) {
      matchedProducts = colorProducts;
    } else {
      // Intersect with category matches
      matchedProducts = matchedProducts.filter(p => colorProducts.some(cp => cp.id === p.id));
    }
  }

  console.log(`After color filter: ${matchedProducts.length} products`);

  // Material matches
  const matchedMaterials = materialKeywords.filter(m => message.includes(m.toLowerCase()));
  if (matchedMaterials.length > 0) {
    console.log(`Matched materials: ${matchedMaterials.join(', ')}`);
    const materialProducts = products.filter(p =>
      matchedMaterials.some(m => p.name.toLowerCase().includes(m.toLowerCase()))
    );
    console.log(`Found ${materialProducts.length} products matching materials`);

    // BUG: Only uses material if no matches yet!
    if (matchedProducts.length === 0) {
      matchedProducts = materialProducts;
      console.log(`⚠️  Using material products as fallback (bug!)`);
    } else {
      console.log(`❌ BUG: Material filter ignored because matchedProducts.length = ${matchedProducts.length}`);
    }
  }

  console.log(`After material filter: ${matchedProducts.length} products`);

  // Remove duplicates
  const uniqueProducts = Array.from(new Map(matchedProducts.map(p => [p.id, p])).values());

  return uniqueProducts.slice(0, 30);
}

// Test with "მწვანე ბამბის ქუდი"
console.log('=== TEST: "მწვანე ბამბის ქუდი" ===\n');
const results = filterProductsByQuery(products, 'მწვანე ბამბის ქუდი');

console.log(`\n=== RESULTS ===`);
console.log(`Total matches: ${results.length}`);
console.log('\nMatched products:');
results.forEach(p => {
  const hasBambis = p.name.includes('ბამბის');
  console.log(`${hasBambis ? '✅' : '❌'} ${p.name} (Stock: ${p.stock})`);
});

const cottonHat = results.find(p => p.name.includes('მწვანე') && p.name.includes('ბამბის'));
console.log(`\n${cottonHat ? '✅ GREEN COTTON HAT FOUND!' : '❌ GREEN COTTON HAT MISSING!'}`);
if (cottonHat) {
  console.log(`  ${cottonHat.name} - Stock: ${cottonHat.stock}`);
}

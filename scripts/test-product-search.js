// Simplified test to check if products exist

// Check if specific products exist
console.log('=== Checking if black and red hats exist in inventory ===');
const products = require('../data/products.json');

const blackHats = products.filter(p =>
  p.name.toLowerCase().includes('შავ') &&
  p.name.toLowerCase().includes('ქუდ')
);
console.log(`\nBlack hats in inventory: ${blackHats.length}`);
blackHats.forEach(p => console.log(`  - ${p.name}: ${p.price} ლარი (${p.stock} in stock)`));

const redHats = products.filter(p =>
  p.name.toLowerCase().includes('წითელ') &&
  p.name.toLowerCase().includes('ქუდ')
);
console.log(`\nRed hats in inventory: ${redHats.length}`);
redHats.forEach(p => console.log(`  - ${p.name}: ${p.price} ლარი (${p.stock} in stock)`));

// Test what the search would find with user's input
console.log('\n=== Testing search patterns ===');

const testPatterns = [
  { query: 'წითელი', desc: 'Correct Georgian for red' },
  { query: 'წითერლ', desc: 'User typo for red' },
  { query: 'shavi', desc: 'Latin transcription for black' },
  { query: 'შავი', desc: 'Correct Georgian for black' },
];

testPatterns.forEach(({ query, desc }) => {
  console.log(`\nSearching for "${query}" (${desc}):`);
  const matches = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(query.toLowerCase()))
  );
  console.log(`  Found ${matches.length} products`);
  if (matches.length > 0) {
    matches.slice(0, 2).forEach(p => console.log(`    - ${p.name}`));
  }
});
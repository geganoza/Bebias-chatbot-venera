const fs = require('fs');
const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));

console.log('Products with valid images:\n');
products.forEach(p => {
  if (p.image && p.image !== 'IMAGE_URL_HERE' && p.image.startsWith('http')) {
    console.log('✅', p.name_en, '(' + p.id + ')');
  }
});

console.log('\nProducts without images:\n');
products.forEach(p => {
  if (!p.image || p.image === 'IMAGE_URL_HERE') {
    console.log('⚠️ ', p.name_en, '(' + p.id + ')');
  }
});

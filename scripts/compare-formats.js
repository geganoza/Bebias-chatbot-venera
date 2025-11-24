#!/usr/bin/env node
const fs = require('fs');

const current = JSON.parse(fs.readFileSync('./data/products.json', 'utf8'));
const backup = JSON.parse(fs.readFileSync('./data/products.json.backup-20251124-223340', 'utf8'));

console.log('=== FIELD STRUCTURE CHECK ===\n');

// Check current file
console.log('Current products.json:');
console.log('Total products:', current.length);

const currentFields = new Set();
current.forEach(p => {
  Object.keys(p).forEach(k => currentFields.add(k));
});
console.log('Unique fields:', Array.from(currentFields).sort());

// Sample products
console.log('\nSample products from current:');
[0, 50, 100, 150, 200, 269].forEach(i => {
  if (current[i]) {
    console.log(`\n[${i}] ${current[i].name}`);
    console.log('  Fields:', Object.keys(current[i]).join(', '));
    console.log('  Types: ', Object.keys(current[i]).map(k => `${k}:${typeof current[i][k]}`).join(', '));
  }
});

console.log('\n\n=== BACKUP FILE ===\n');
console.log('Backup products.json:');
console.log('Total products:', backup.length);

const backupFields = new Set();
backup.forEach(p => {
  Object.keys(p).forEach(k => backupFields.add(k));
});
console.log('Unique fields:', Array.from(backupFields).sort());

// Sample products from backup
console.log('\nSample products from backup:');
[0, 50, 100, 150, 200, 278].forEach(i => {
  if (backup[i]) {
    console.log(`\n[${i}] ${backup[i].name}`);
    console.log('  Fields:', Object.keys(backup[i]).join(', '));
    console.log('  Types: ', Object.keys(backup[i]).map(k => `${k}:${typeof backup[i][k]}`).join(', '));
  }
});

console.log('\n\n=== COMPARISON ===');
const sameFields = JSON.stringify(Array.from(currentFields).sort()) === JSON.stringify(Array.from(backupFields).sort());
console.log('Same field names:', sameFields ? '✅ YES' : '❌ NO');

// Check if ALL products have the same 8 fields
console.log('\nChecking ALL products for consistency...');

const expectedFields = ['id', 'name', 'price', 'currency', 'category', 'stock', 'image', 'short_description'].sort();

let currentConsistent = true;
current.forEach((p, i) => {
  const fields = Object.keys(p).sort();
  if (JSON.stringify(fields) !== JSON.stringify(expectedFields)) {
    console.log(`❌ Current [${i}] ${p.name} has different fields:`, fields);
    currentConsistent = false;
  }
});

let backupConsistent = true;
backup.forEach((p, i) => {
  const fields = Object.keys(p).sort();
  if (JSON.stringify(fields) !== JSON.stringify(expectedFields)) {
    console.log(`❌ Backup [${i}] ${p.name} has different fields:`, fields);
    backupConsistent = false;
  }
});

if (currentConsistent) {
  console.log('✅ Current: All 270 products have identical 8 fields');
}
if (backupConsistent) {
  console.log('✅ Backup: All 279 products have identical 8 fields');
}

console.log('\n=== FORMAT CHECK ===');
console.log('Expected format for each product:');
console.log(JSON.stringify({
  id: "string",
  name: "string",
  price: "number",
  currency: "string",
  category: "string",
  stock: "number",
  image: "string (percent-encoded URL)",
  short_description: "string"
}, null, 2));

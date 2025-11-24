#!/usr/bin/env node

function parseImageCommands(response) {
  console.log(`🔍 Testing parseImageCommands\n`);
  console.log(`Input response:\n${response}\n`);

  // Updated regex to support Georgian characters, spaces, and any product ID format
  const imageRegex = /SEND_IMAGE:\s*(.+?)(?:\n|$)/gi;
  const matches = [...response.matchAll(imageRegex)];
  console.log(`🔍 Found ${matches.length} SEND_IMAGE matches`);

  const productIds = matches.map(match => {
    console.log(`🔍 Matched product ID: "${match[1]}"`);
    return match[1].trim();
  });

  // Remove SEND_IMAGE commands from response
  const cleanResponse = response.replace(imageRegex, '').trim();

  console.log(`\n✅ Product IDs:`, productIds);
  console.log(`\n✅ Clean response:\n${cleanResponse}`);

  return { productIds, cleanResponse };
}

// Test cases
console.log('=== TEST 1: Georgian ID with spaces ===\n');
parseImageCommands(`მწვანე ბამბის მოკლე ქუდი - 49 ლარი 💛
გინდა შეუკვეთო?
SEND_IMAGE: მწვანე ბამბის მოკლე ქუდი M`);

console.log('\n\n=== TEST 2: Numeric ID ===\n');
parseImageCommands(`აგურისფერი ქუდი - 59 ლარი
SEND_IMAGE: 4714
გინდა?`);

console.log('\n\n=== TEST 3: Multiple images ===\n');
parseImageCommands(`გვაქვს ორი ვარიანტი:
1. ლურჯი ქუდი
SEND_IMAGE: 9016
2. მწვანე ქუდი
SEND_IMAGE: მწვანე ბამბის მოკლე ქუდი M
რომელი მოგწონს?`);

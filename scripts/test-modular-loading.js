#!/usr/bin/env node

/**
 * Test script to verify modular instruction loading
 */

const path = require('path');

// Test the loading logic
async function testModularLoading() {
  console.log('🧪 Testing Modular Instruction Loading\n');
  console.log('=' .repeat(50));

  // Import the bot-core module
  const { loadAllContent } = require('../lib/bot-core');

  console.log('\n📋 Test 1: Loading for Giorgi (3282789748459241)');
  console.log('-'.repeat(40));
  try {
    const giorgisContent = await loadAllContent('3282789748459241');

    // Check if modular instructions loaded
    const hasModularContent = giorgisContent.instructions.includes('VENERA - BEBIAS Chatbot Main Instructions');
    const hasContextRules = giorgisContent.instructions.includes('Context Awareness Rules');

    console.log('✅ Content loaded successfully');
    console.log(`   - Has modular instructions: ${hasModularContent ? '✅' : '❌'}`);
    console.log(`   - Has context rules: ${hasContextRules ? '✅' : '❌'}`);
    console.log(`   - Instructions length: ${giorgisContent.instructions.length} chars`);

    // Show first line to verify
    const firstLine = giorgisContent.instructions.split('\n')[0];
    console.log(`   - First line: "${firstLine.substring(0, 50)}..."`);
  } catch (error) {
    console.error('❌ Error loading for Giorgi:', error.message);
  }

  console.log('\n📋 Test 2: Loading for Regular User (123456789)');
  console.log('-'.repeat(40));
  try {
    const regularContent = await loadAllContent('123456789');

    // Check if regular instructions loaded
    const hasRegularContent = regularContent.instructions.includes('ORDER CONFIRMATION FORMAT');

    console.log('✅ Content loaded successfully');
    console.log(`   - Has regular instructions: ${hasRegularContent ? '✅' : '❌'}`);
    console.log(`   - Instructions length: ${regularContent.instructions.length} chars`);

    // Show first line to verify
    const firstLine = regularContent.instructions.split('\n')[0];
    console.log(`   - First line: "${firstLine.substring(0, 50)}..."`);
  } catch (error) {
    console.error('❌ Error loading for regular user:', error.message);
  }

  console.log('\n📋 Test 3: Loading without senderId');
  console.log('-'.repeat(40));
  try {
    const defaultContent = await loadAllContent();

    console.log('✅ Content loaded successfully (should be regular)');
    console.log(`   - Instructions length: ${defaultContent.instructions.length} chars`);
  } catch (error) {
    console.error('❌ Error loading default:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Testing complete!\n');
}

// Run the test
testModularLoading().catch(console.error);
#!/usr/bin/env node
/**
 * Test BOG API Integration
 * 
 * This script tests the BOG API connection and displays account information
 * 
 * Usage:
 *   node test-bog-api.js
 */

import { BOGClient } from './lib/bogClient.ts';

async function testBOGAPI() {
    console.log('🏦 Testing BOG API Integration');
    console.log('='.repeat(60));
    console.log();

    // Get credentials from environment
    const clientId = process.env.BOG_CLIENT_ID;
    const clientSecret = process.env.BOG_CLIENT_SECRET;
    const accountId = process.env.BOG_ACCOUNT_ID;
    const environment = process.env.BOG_ENVIRONMENT || 'sandbox';

    if (!clientId || !clientSecret) {
        console.error('❌ Error: BOG_CLIENT_ID and BOG_CLIENT_SECRET must be set');
        console.log();
        console.log('Set them in your .env.local file:');
        console.log('BOG_CLIENT_ID=your_client_id');
        console.log('BOG_CLIENT_SECRET=your_client_secret');
        console.log('BOG_ACCOUNT_ID=your_account_id (optional)');
        console.log('BOG_ENVIRONMENT=sandbox (or production)');
        process.exit(1);
    }

    console.log('📋 Configuration:');
    console.log(`   Client ID: ${clientId.substring(0, 10)}...`);
    console.log(`   Environment: ${environment}`);
    if (accountId) {
        console.log(`   Account ID: ${accountId}`);
    }
    console.log();

    // Create BOG client
    const bog = new BOGClient({
        clientId,
        clientSecret,
        accountId,
        environment: environment,
    });

    // Test 1: Authentication
    console.log('🔐 Test 1: Authentication');
    console.log('-'.repeat(60));
    const authenticated = await bog.authenticate();

    if (!authenticated) {
        console.error('❌ Authentication failed');
        console.log();
        console.log('Possible issues:');
        console.log('  - Invalid client ID or secret');
        console.log('  - Wrong environment (sandbox vs production)');
        console.log('  - Network connectivity issues');
        process.exit(1);
    }

    console.log('✅ Authentication successful!');
    console.log();

    // Test 2: Get Account Info
    if (accountId) {
        console.log('💳 Test 2: Get Account Information');
        console.log('-'.repeat(60));
        const accountInfo = await bog.getAccountInfo();

        if (accountInfo) {
            console.log('✅ Account info retrieved:');
            console.log(`   Account Number: ${accountInfo.accountNumber}`);
            console.log(`   Account Name: ${accountInfo.accountName}`);
            console.log(`   Currency: ${accountInfo.currency}`);
            console.log(`   Balance: ${accountInfo.balance} ${accountInfo.currency}`);
        } else {
            console.log('⚠️  Could not retrieve account info');
            console.log('   This might be normal for sandbox environment');
        }
        console.log();

        // Test 3: Get Recent Transactions
        console.log('📊 Test 3: Get Recent Transactions');
        console.log('-'.repeat(60));
        const transactions = await bog.getTransactions(accountId, {
            limit: 10,
        });

        if (transactions.length > 0) {
            console.log(`✅ Retrieved ${transactions.length} transactions:`);
            console.log();
            transactions.slice(0, 5).forEach((tx, index) => {
                console.log(`   ${index + 1}. ${tx.date}`);
                console.log(`      Amount: ${tx.amount} ${tx.currency}`);
                console.log(`      Type: ${tx.type}`);
                console.log(`      Description: ${tx.description || 'N/A'}`);
                if (tx.counterpartyName) {
                    console.log(`      From/To: ${tx.counterpartyName}`);
                }
                console.log();
            });
        } else {
            console.log('ℹ️  No transactions found');
            console.log('   This might be normal for sandbox environment');
        }
        console.log();

        // Test 4: Search for a transaction
        console.log('🔍 Test 4: Search for Transaction');
        console.log('-'.repeat(60));
        console.log('Searching for transaction with amount 59 GEL...');
        const foundTx = await bog.findTransaction(59, 'test', { accountId });

        if (foundTx) {
            console.log('✅ Found matching transaction:');
            console.log(`   ID: ${foundTx.id}`);
            console.log(`   Amount: ${foundTx.amount} ${foundTx.currency}`);
            console.log(`   Description: ${foundTx.description}`);
        } else {
            console.log('ℹ️  No matching transaction found');
            console.log('   This is expected if there are no recent 59 GEL transactions');
        }
    } else {
        console.log('⚠️  Skipping account tests (no BOG_ACCOUNT_ID set)');
        console.log('   Set BOG_ACCOUNT_ID in .env.local to test account features');
    }

    console.log();
    console.log('='.repeat(60));
    console.log('✅ All tests completed!');
    console.log();
    console.log('Next steps:');
    console.log('  1. If using sandbox, test with sandbox data');
    console.log('  2. For production, set BOG_ENVIRONMENT=production');
    console.log('  3. Integrate with your chatbot order flow');
    console.log('='.repeat(60));
}

// Run tests
testBOGAPI().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * Test Payment Detection
 *
 * Use this after making a test payment to see if the API can detect it
 *
 * Usage:
 *   1. Make a payment to your account with description "TEST ORDER #12345"
 *   2. Run: node test-payment-detection.js
 */

import { getBOGClient } from './lib/bogClient.ts';

async function testPaymentDetection() {
    console.log('💰 Testing Payment Detection');
    console.log('='.repeat(60));
    console.log();

    try {
        const bog = getBOGClient();

        // Step 1: Authenticate
        console.log('🔐 Authenticating...');
        const authenticated = await bog.authenticate();

        if (!authenticated) {
            console.error('❌ Authentication failed');
            process.exit(1);
        }
        console.log('✅ Authenticated');
        console.log();

        // Step 2: Get account info
        console.log('💳 Getting account information...');
        const accountInfo = await bog.getAccountInfo();

        if (accountInfo) {
            console.log('✅ Account Info:');
            console.log(`   Account: ${accountInfo.accountNumber}`);
            console.log(`   Currency: ${accountInfo.currency}`);
            console.log(`   Balance: ${accountInfo.balance} ${accountInfo.currency}`);
            console.log();
        } else {
            console.error('❌ Could not retrieve account info');
            console.log('   Make sure your account is linked to the API credentials');
            process.exit(1);
        }

        // Step 3: Get recent transactions
        console.log('📊 Getting recent transactions (last 7 days)...');
        const transactions = await bog.getTransactions(undefined, {
            fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            limit: 20,
        });

        if (transactions.length === 0) {
            console.log('ℹ️  No transactions found in the last 7 days');
            console.log();
            console.log('To test payment detection:');
            console.log(`1. Make a payment to: ${accountInfo.accountNumber}`);
            console.log('2. Amount: 1 GEL (or any test amount)');
            console.log('3. Description: TEST ORDER #12345');
            console.log('4. Wait 1-2 minutes for it to process');
            console.log('5. Run this script again');
            process.exit(0);
        }

        console.log(`✅ Found ${transactions.length} transactions:`);
        console.log();

        // Display transactions
        transactions.forEach((tx, index) => {
            const emoji = tx.type === 'credit' ? '📥' : '📤';
            console.log(`${emoji} ${index + 1}. ${tx.date}`);
            console.log(`   Amount: ${tx.amount} ${tx.currency} (${tx.type})`);
            console.log(`   Description: ${tx.description || 'N/A'}`);
            if (tx.counterpartyName) {
                console.log(`   From/To: ${tx.counterpartyName}`);
            }
            console.log();
        });

        // Step 4: Search for test payment
        console.log('🔍 Searching for test payment...');
        console.log('   Looking for: "TEST ORDER" or "test" in description');
        console.log();

        const testPayment = transactions.find(tx =>
            tx.type === 'credit' &&
            (tx.description?.toLowerCase().includes('test') ||
             tx.description?.toLowerCase().includes('order'))
        );

        if (testPayment) {
            console.log('✅ FOUND TEST PAYMENT!');
            console.log(`   ID: ${testPayment.id}`);
            console.log(`   Amount: ${testPayment.amount} ${testPayment.currency}`);
            console.log(`   Date: ${testPayment.date}`);
            console.log(`   Description: ${testPayment.description}`);
            console.log();
            console.log('🎉 Payment detection is working!');
            console.log('   You can now integrate this with your chatbot order flow.');
        } else {
            console.log('ℹ️  No test payment found');
            console.log('   Make a payment with "TEST ORDER #12345" in the description');
        }

        console.log();
        console.log('='.repeat(60));
        console.log('✅ Test completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testPaymentDetection().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

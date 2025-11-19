#!/usr/bin/env node
/**
 * Test Payment Verification by Customer Name
 *
 * This demonstrates how to verify payments when you only have:
 * - Customer name
 * - Expected amount
 * - (Optional) Order number
 */

import { getBOGClient } from './lib/bogClient.ts';

async function testVerifyByName() {
    console.log('🔍 Testing Payment Verification by Customer Name');
    console.log('='.repeat(60));
    console.log();

    const bog = getBOGClient();
    await bog.authenticate();

    // First, show recent payments to see what we have
    console.log('📊 Recent incoming payments (last 3 days):');
    console.log('-'.repeat(60));

    const allTransactions = await bog.getTransactions(undefined, {
        fromDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        limit: 30,
    });

    const incomingPayments = allTransactions.filter(tx => tx.type === 'credit');

    incomingPayments.forEach((tx, index) => {
        console.log(`${index + 1}. ${tx.date.split('T')[0]}`);
        console.log(`   Amount: ${tx.amount} GEL`);
        console.log(`   From: ${tx.counterpartyName || 'Unknown'}`);
        console.log(`   Description: ${tx.description}`);
        console.log();
    });

    console.log('='.repeat(60));
    console.log();

    // Test verification with different customer names
    const testCases = [
        { name: 'ილია კახიძე', amount: 60 },
        { name: 'ილია', amount: 60 },
        { name: 'კახიძე', amount: 60 },
        { name: 'გიორგი', amount: 1 },
        { name: 'Giorgi', amount: 1 },
    ];

    console.log('🧪 Testing payment verification:');
    console.log('-'.repeat(60));

    for (const testCase of testCases) {
        console.log(`\nSearching: "${testCase.name}" with ${testCase.amount} GEL`);

        const result = await bog.verifyPaymentByName(
            testCase.name,
            testCase.amount,
            undefined, // No order number
            {
                fromDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            }
        );

        if (result.verified && result.transaction) {
            console.log(`✅ VERIFIED!`);
            console.log(`   Sender: ${result.transaction.counterpartyName}`);
            console.log(`   Amount: ${result.transaction.amount} GEL`);
            console.log(`   Date: ${result.transaction.date}`);
        } else {
            console.log(`❌ Not found`);
        }
    }

    console.log();
    console.log('='.repeat(60));
    console.log();
    console.log('💡 How to use in chatbot:');
    console.log();
    console.log('When customer says they made a payment:');
    console.log('1. Ask for their NAME (as it appears on their bank account)');
    console.log('2. Get the AMOUNT from the order total');
    console.log('3. Call: bog.verifyPaymentByName(customerName, amount, orderNumber)');
    console.log('4. If verified, automatically confirm the order!');
}

testVerifyByName().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

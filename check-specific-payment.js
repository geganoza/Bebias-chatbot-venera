#!/usr/bin/env node
/**
 * Check for 1 GEL payment with full details
 */

import { getBOGClient } from './lib/bogClient.ts';

async function checkPayment() {
    console.log('🔍 Searching for 1 GEL payment...');
    console.log('='.repeat(60));

    const bog = getBOGClient();

    // Authenticate
    await bog.authenticate();

    // Get transactions from last 24 hours
    const transactions = await bog.getTransactions(undefined, {
        fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        limit: 50,
    });

    console.log(`Found ${transactions.length} transactions in last 24 hours`);
    console.log();

    // Find 1 GEL credit transactions
    const oneGelPayments = transactions.filter(tx =>
        tx.type === 'credit' && Math.abs(tx.amount - 1) < 0.01
    );

    if (oneGelPayments.length === 0) {
        console.log('❌ No 1 GEL incoming payments found');
        console.log('The payment might not have appeared yet. Wait 1-2 minutes and try again.');
    } else {
        console.log(`✅ Found ${oneGelPayments.length} x 1 GEL payment(s):`);
        console.log();

        oneGelPayments.forEach((tx, index) => {
            console.log(`Payment #${index + 1}:`);
            console.log(`   ID: ${tx.id}`);
            console.log(`   Date: ${tx.date}`);
            console.log(`   Amount: ${tx.amount} ${tx.currency}`);
            console.log(`   Type: ${tx.type}`);
            console.log(`   Description: ${tx.description || 'N/A'}`);
            console.log(`   Sender Name: ${tx.counterpartyName || 'N/A'}`);
            console.log(`   Sender Account: ${tx.counterpartyAccount || 'N/A'}`);
            console.log();
        });
    }

    console.log('='.repeat(60));
}

checkPayment().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

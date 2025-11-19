#!/usr/bin/env node
/**
 * Test transaction retrieval with different date ranges
 */

import { getBOGClient } from './lib/bogClient.ts';

async function testTransactions() {
    console.log('📊 Testing Transaction Retrieval');
    console.log('='.repeat(60));

    const bog = getBOGClient();

    // Authenticate
    console.log('🔐 Authenticating...');
    await bog.authenticate();
    console.log('✅ Authenticated');
    console.log();

    // Test different date ranges
    const dateRanges = [
        { label: 'Last 7 days', days: 7 },
        { label: 'Last 30 days', days: 30 },
        { label: 'Last 90 days', days: 90 },
        { label: 'Last 180 days', days: 180 },
    ];

    for (const range of dateRanges) {
        console.log(`Testing: ${range.label}`);
        const fromDate = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString();

        const transactions = await bog.getTransactions(undefined, {
            fromDate,
            limit: 10,
        });

        console.log(`   Found: ${transactions.length} transactions`);

        if (transactions.length > 0) {
            console.log('   Latest transaction:');
            const latest = transactions[0];
            console.log(`      Date: ${latest.date}`);
            console.log(`      Amount: ${latest.amount} ${latest.currency}`);
            console.log(`      Type: ${latest.type}`);
            console.log(`      Description: ${latest.description || 'N/A'}`);
            break; // Found some, no need to test further
        }
        console.log();
    }

    console.log('='.repeat(60));
}

testTransactions().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * Check for 1 GEL payment and show ALL fields from the API
 */

import { getBOGClient } from './lib/bogClient.ts';

async function check1GelPayment() {
    console.log('🔍 Checking for 1 GEL payment with ALL details...');
    console.log('='.repeat(60));

    const bog = getBOGClient();
    await bog.authenticate();

    // Get very recent transactions
    const response = await fetch(
        `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/2025-11-19/2025-11-19`,
        {
            headers: {
                'Authorization': `Bearer ${bog.accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const data = await response.json();

    console.log('📋 Today\'s transactions:');
    console.log(`   Total found: ${data.Count || 0}`);
    console.log();

    if (data.Records && data.Records.length > 0) {
        data.Records.forEach((record, index) => {
            const isCredit = record.EntryAmountCredit > 0;
            const amount = isCredit ? record.EntryAmountCredit : record.EntryAmountDebit;

            console.log(`Transaction #${index + 1}:`);
            console.log(`   Type: ${isCredit ? '📥 INCOMING' : '📤 OUTGOING'}`);
            console.log(`   Amount: ${amount} GEL`);
            console.log(`   Date: ${record.EntryDate}`);
            console.log(`   Description: ${record.EntryComment || 'N/A'}`);
            console.log();
            console.log('   📋 ALL AVAILABLE FIELDS:');

            // Show all fields in the record
            Object.keys(record).forEach(key => {
                if (record[key] !== null && record[key] !== '' && record[key] !== 0) {
                    console.log(`      ${key}: ${record[key]}`);
                }
            });
            console.log();
            console.log('-'.repeat(60));
            console.log();

            // Highlight 1 GEL payments
            if (Math.abs(amount - 1) < 0.01) {
                console.log('🎯 THIS IS THE 1 GEL PAYMENT! ☝️');
                console.log();
            }
        });
    } else {
        console.log('❌ No transactions found today yet');
        console.log('   The payment might take 1-5 minutes to appear');
    }

    console.log('='.repeat(60));
}

check1GelPayment().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});

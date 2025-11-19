#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function checkLast2Days() {
    const bog = getBOGClient();
    await bog.authenticate();

    const response = await fetch(
        `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/2025-11-18/2025-11-19`,
        {
            headers: {
                'Authorization': `Bearer ${bog.accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const data = await response.json();

    console.log('📊 Last 2 days transactions:', data.Count);
    console.log('='.repeat(60));
    console.log();

    if (data.Records) {
        // Show incoming payments only
        const incoming = data.Records.filter(r => r.EntryAmountCredit > 0);

        console.log(`📥 Incoming payments: ${incoming.length}`);
        console.log();

        incoming.forEach((record, idx) => {
            console.log(`Payment #${idx + 1}:`);
            console.log(`   Amount: ${record.EntryAmountCredit} GEL`);
            console.log(`   Date: ${record.EntryDate}`);
            console.log(`   Description: ${record.EntryComment || 'N/A'}`);
            console.log();
            console.log('   📋 ALL FIELDS IN THIS TRANSACTION:');
            Object.keys(record).sort().forEach(key => {
                const value = record[key];
                if (value !== null && value !== '' && value !== 0 && value !== false) {
                    console.log(`      ${key}: ${JSON.stringify(value)}`);
                }
            });
            console.log();
            console.log('-'.repeat(60));
            console.log();
        });
    }
}

checkLast2Days().catch(console.error);

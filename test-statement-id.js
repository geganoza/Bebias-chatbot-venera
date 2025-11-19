#!/usr/bin/env node
/**
 * Test using statement ID for more current data
 */

import { getBOGClient } from './lib/bogClient.ts';

async function testStatementId() {
    console.log('🔍 Testing Statement ID for current data');
    console.log('='.repeat(60));

    const bog = getBOGClient();
    await bog.authenticate();

    // First, generate a statement for today
    const statementUrl = `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/2025-11-19/2025-11-19`;

    console.log('Step 1: Generate statement for today...');
    const statementResponse = await fetch(statementUrl, {
        headers: {
            'Authorization': `Bearer ${bog.accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    const statementData = await statementResponse.json();
    console.log(`Statement ID: ${statementData.Id}`);
    console.log(`Count: ${statementData.Count}`);
    console.log();

    if (statementData.Id) {
        // Now try to get data using the statement ID with paging
        console.log('Step 2: Fetch data using statement ID...');

        const pagingUrl = `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/${statementData.Id}/1`;
        console.log(`Calling: ${pagingUrl}`);

        const pagingResponse = await fetch(pagingUrl, {
            headers: {
                'Authorization': `Bearer ${bog.accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (pagingResponse.ok) {
            const pagingData = await pagingResponse.json();
            console.log(`✅ Success!`);
            console.log(`ID: ${pagingData.Id}`);
            console.log(`Count: ${pagingData.Count}`);

            if (pagingData.Records && pagingData.Records.length > 0) {
                console.log(`\nFound ${pagingData.Records.length} records:`);
                pagingData.Records.forEach((r, i) => {
                    const isCredit = r.EntryAmountCredit > 0;
                    const amount = isCredit ? r.EntryAmountCredit : r.EntryAmountDebit;
                    const sender = r.DocumentPayerName || 'Unknown';
                    console.log(`${i+1}. ${amount} GEL ${isCredit ? 'IN' : 'OUT'} - ${sender}`);
                });

                // Check for 1 GEL
                const oneGel = pagingData.Records.find(r => Math.abs(r.EntryAmountCredit - 1) < 0.01);
                if (oneGel) {
                    console.log('\n🎯 FOUND 1 GEL PAYMENT!');
                    console.log(`From: ${oneGel.DocumentPayerName}`);
                }
            }
        } else {
            console.log(`❌ Failed: ${pagingResponse.status}`);
        }
    }

    console.log('='.repeat(60));
}

testStatementId().catch(console.error);

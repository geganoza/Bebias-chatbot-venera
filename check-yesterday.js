#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function checkYesterday() {
    const bog = getBOGClient();
    await bog.authenticate();

    // Maybe the payment is showing under a different date
    const dates = [
        ['2025-11-19', '2025-11-19'],  // Today only
        ['2025-11-18', '2025-11-19'],  // Yesterday to today
        ['2025-11-19', '2025-11-20'],  // Today to tomorrow (in case of timezone)
    ];

    for (const [start, end] of dates) {
        const url = `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/${start}/${end}`;
        
        console.log(`\nChecking ${start} to ${end}...`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${bog.accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        console.log(`Count: ${data.Count}`);
        
        if (data.Records) {
            const oneGel = data.Records.filter(r => Math.abs(r.EntryAmountCredit - 1) < 0.01);
            if (oneGel.length > 0) {
                console.log(`🎯 FOUND ${oneGel.length} x 1 GEL payment(s)!`);
                oneGel.forEach(r => {
                    console.log(`   From: ${r.DocumentPayerName}`);
                    console.log(`   Date: ${r.EntryDate}`);
                });
            }
        }
    }
}

checkYesterday().catch(console.error);

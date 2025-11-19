#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function test() {
    const bog = getBOGClient();
    await bog.authenticate();

    const today = '2025-11-19';
    
    // Try statement with just today's date
    const url = `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/${today}/${today}`;
    
    console.log(`Testing: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${bog.accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
        const data = await response.json();
        console.log(`Found ${data.Count} transactions today`);
        
        if (data.Records) {
            console.log('\nToday\'s transactions:');
            data.Records.forEach((r, i) => {
                const isCredit = r.EntryAmountCredit > 0;
                const amount = isCredit ? r.EntryAmountCredit : r.EntryAmountDebit;
                const sender = r.DocumentPayerName || r.SenderDetails?.Name || 'Unknown';
                console.log(`${i+1}. ${amount} GEL ${isCredit ? 'IN' : 'OUT'} from ${sender}`);
                console.log(`   Description: ${r.EntryComment}`);
            });
        }
    }
}

test().catch(console.error);

#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function checkAll() {
    const bog = getBOGClient();
    await bog.authenticate();

    // Check last 7 days
    const url = `https://api.businessonline.ge/api/statement/GE31BG0000000101465259/GEL/2025-11-12/2025-11-19`;
    
    console.log('📊 Checking all recent transactions (last 7 days)...');
    console.log('='.repeat(60));
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${bog.accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json();
    console.log(`Total transactions: ${data.Count}`);
    console.log();

    if (data.Records) {
        const incoming = data.Records.filter(r => r.EntryAmountCredit > 0);
        
        console.log(`📥 Incoming payments: ${incoming.length}`);
        console.log();
        
        // Show all incoming with amounts
        incoming.forEach((r, i) => {
            const sender = r.DocumentPayerName || r.SenderDetails?.Name || 'Unknown';
            console.log(`${i+1}. ${r.EntryAmountCredit} GEL - ${r.EntryDate.split('T')[0]}`);
            console.log(`   From: ${sender}`);
            console.log(`   Desc: ${r.EntryComment}`);
            
            // Highlight 1 GEL payment
            if (Math.abs(r.EntryAmountCredit - 1) < 0.01) {
                console.log('   🎯 THIS IS THE 1 GEL PAYMENT!');
            }
            console.log();
        });
        
        // Search specifically for 1 GEL
        const oneGel = incoming.filter(r => Math.abs(r.EntryAmountCredit - 1) < 0.01);
        if (oneGel.length > 0) {
            console.log('='.repeat(60));
            console.log('✅ FOUND 1 GEL PAYMENT(S)!');
            console.log('='.repeat(60));
        } else {
            console.log('❌ No 1 GEL payments found in API yet');
        }
    }
}

checkAll().catch(console.error);

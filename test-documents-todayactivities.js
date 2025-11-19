#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function testTodayActivities() {
    console.log('🎯 Testing DOCUMENTS/TODAYACTIVITIES Endpoint');
    console.log('='.repeat(60));

    const bog = getBOGClient();
    await bog.authenticate();

    const url = `https://api.businessonline.ge/api/documents/todayactivities/GE31BG0000000101465259/GEL`;
    
    console.log(`Calling: ${url}`);
    console.log();

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${bog.accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
        const data = await response.json();
        
        console.log(`\n✅ SUCCESS! Real-time transactions endpoint found!`);
        console.log(`=`.repeat(60));
        console.log();

        if (Array.isArray(data)) {
            console.log(`📊 Today's Transactions: ${data.length}`);
            console.log();

            data.forEach((tx, i) => {
                const isCredit = tx.Credit > 0;
                const amount = isCredit ? tx.Credit : tx.Debit;
                
                console.log(`${i + 1}. ${isCredit ? '📥 IN' : '📤 OUT'} ${amount} GEL`);
                console.log(`   Date: ${tx.PostDate}`);
                console.log(`   Payer: ${tx.PayerName || tx.Sender?.Name || 'N/A'}`);
                console.log(`   Description: ${tx.EntryComment || tx.Nomination}`);
                
                if (Math.abs(amount - 1) < 0.01) {
                    console.log(`   🎯 THIS IS THE 1 GEL PAYMENT!`);
                }
                console.log();
            });

            // Search for 1 GEL payment
            const oneGel = data.filter(tx => Math.abs(tx.Credit - 1) < 0.01);
            if (oneGel.length > 0) {
                console.log('='.repeat(60));
                console.log('🎉 FOUND YOUR 1 GEL TEST PAYMENT!');
                console.log('='.repeat(60));
                console.log(`Sender: ${oneGel[0].PayerName || oneGel[0].Sender?.Name}`);
                console.log(`Amount: ${oneGel[0].Credit} GEL`);
                console.log(`Date: ${oneGel[0].PostDate}`);
            }
        } else {
            console.log('Unexpected response format:', data);
        }
    } else {
        const error = await response.text();
        console.log(`❌ Error: ${error.substring(0, 200)}`);
    }

    console.log();
    console.log('='.repeat(60));
}

testTodayActivities().catch(console.error);

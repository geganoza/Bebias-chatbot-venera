#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function testTodayActivities() {
    console.log('🔍 Testing TODAY ACTIVITIES Endpoint');
    console.log('='.repeat(60));

    const bog = getBOGClient();
    await bog.authenticate();

    const accountNumber = 'GE31BG0000000101465259';
    const currency = 'GEL';

    // Try different URL patterns for todayactivities
    const urls = [
        `https://api.businessonline.ge/api/todayactivities/${accountNumber}/${currency}`,
        `https://api.businessonline.ge/api/statement/todayactivities/${accountNumber}/${currency}`,
        `https://api.businessonline.ge/api/activities/today/${accountNumber}/${currency}`,
    ];

    for (const url of urls) {
        console.log(`\nTrying: ${url}`);

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${bog.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log(`Status: ${response.status} ${response.statusText}`);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ SUCCESS!');
                console.log(`Response keys:`, Object.keys(data));
                console.log(`Count:`, data.Count || data.count || 'N/A');

                if (data.Records || data.records) {
                    const records = data.Records || data.records;
                    console.log(`\n📊 Found ${records.length} today's transactions:`);

                    records.forEach((r, i) => {
                        const isCredit = r.EntryAmountCredit > 0;
                        const amount = isCredit ? r.EntryAmountCredit : r.EntryAmountDebit;
                        const sender = r.DocumentPayerName || r.SenderDetails?.Name || 'Unknown';

                        console.log(`${i+1}. ${amount} GEL ${isCredit ? 'IN' : 'OUT'} from ${sender}`);

                        if (Math.abs(amount - 1) < 0.01) {
                            console.log('   🎯 THIS IS THE 1 GEL PAYMENT!');
                        }
                    });
                }

                console.log('\n' + '='.repeat(60));
                console.log('🎉 FOUND THE REAL-TIME ENDPOINT!');
                console.log('='.repeat(60));
                return;
            }
        } catch (error) {
            console.log(`Error: ${error.message}`);
        }
    }

    console.log('\n❌ todayactivities endpoint not found with these patterns');
}

testTodayActivities().catch(console.error);

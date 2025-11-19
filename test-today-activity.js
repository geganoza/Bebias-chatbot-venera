#!/usr/bin/env node
/**
 * Test different endpoints to find real-time transaction history
 */

import { getBOGClient } from './lib/bogClient.ts';

async function testTodayActivity() {
    console.log('🔍 Testing Real-Time Transaction Endpoints');
    console.log('='.repeat(60));

    const bog = getBOGClient();
    await bog.authenticate();

    const baseUrl = 'https://api.businessonline.ge/api';
    const accountNumber = 'GE31BG0000000101465259';
    const currency = 'GEL';

    // Possible endpoint patterns for today's activities
    const endpoints = [
        `/todayactivities/${accountNumber}/${currency}`,
        `/todayactivity/${accountNumber}/${currency}`,
        `/statement/new/${accountNumber}/${currency}`,
        `/statement/today/${accountNumber}/${currency}`,
        `/transactions/${accountNumber}/${currency}`,
        `/transactions/today/${accountNumber}/${currency}`,
        `/history/${accountNumber}/${currency}`,
        `/accounts/${accountNumber}/${currency}/transactions`,
        `/accounts/${accountNumber}/${currency}/today`,
    ];

    for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`;
        console.log(`\nTrying: ${url}`);

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${bog.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            console.log(`   Status: ${response.status} ${response.statusText}`);

            if (response.ok) {
                const data = await response.json();
                console.log(`   ✅ SUCCESS! Found working endpoint!`);
                console.log(`   Response keys:`, Object.keys(data));

                if (data.Records || data.Transactions || data.Entries) {
                    const records = data.Records || data.Transactions || data.Entries;
                    console.log(`   📊 Found ${records.length} transactions`);

                    if (records.length > 0) {
                        console.log(`   Latest transaction:`, JSON.stringify(records[0], null, 2).substring(0, 300));
                    }
                }

                console.log('\n' + '='.repeat(60));
                console.log('🎯 USE THIS ENDPOINT FOR REAL-TIME TRANSACTIONS!');
                console.log('='.repeat(60));
                break;
            } else if (response.status !== 404) {
                const error = await response.text();
                console.log(`   Error: ${error.substring(0, 100)}`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test completed');
}

testTodayActivity().catch(console.error);

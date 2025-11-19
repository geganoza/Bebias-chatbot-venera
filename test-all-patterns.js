#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function testAll() {
    const bog = getBOGClient();
    await bog.authenticate();

    const account = 'GE31BG0000000101465259';
    const currency = 'GEL';

    // Try ALL possible patterns
    const patterns = [
        // Query params style
        `/todayactivities?accountNumber=${account}&currency=${currency}`,
        `/statement/todayactivities?accountNumber=${account}&currency=${currency}`,
        `/activities?accountNumber=${account}&currency=${currency}`,
        
        // Mixed style
        `/todayactivities/${account}?currency=${currency}`,
        `/statement/todayactivities/${account}?currency=${currency}`,
    ];

    for (const pattern of patterns) {
        const url = `https://api.businessonline.ge/api${pattern}`;
        console.log(`\nTrying: ${url.substring(0, 80)}...`);

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${bog.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 200) {
                const data = await response.json();
                console.log(`✅ FOUND IT!`);
                console.log(JSON.stringify(data, null, 2).substring(0, 500));
                return;
            } else {
                console.log(`   ${response.status}`);
            }
        } catch (e) {
            console.log(`   Error: ${e.message.substring(0, 50)}`);
        }
    }
}

testAll().catch(console.error);

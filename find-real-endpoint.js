#!/usr/bin/env node
import { getBOGClient } from './lib/bogClient.ts';

async function findEndpoint() {
    const bog = getBOGClient();
    await bog.authenticate();

    const baseUrl = 'https://api.businessonline.ge/api';
    const account = 'GE31BG0000000101465259';
    const currency = 'GEL';
    const today = '2025-11-19';

    // Try all possible endpoint variations
    const endpoints = [
        // Turnover / Activity based
        `/turnover/${account}/${currency}`,
        `/turnover/${account}/${currency}/${today}`,
        `/turnover/${account}/${currency}/${today}/${today}`,
        `/activity/${account}/${currency}`,
        `/activity/${account}/${currency}/${today}`,
        `/todayactivity/${account}/${currency}`,
        
        // Movement based  
        `/movements/${account}/${currency}`,
        `/movements/${account}/${currency}/${today}`,
        
        // Operations based
        `/operations/${account}/${currency}`,
        `/operations/${account}/${currency}/${today}/${today}`,
        
        // Different statement formats
        `/statement/${account}/${currency}`,
        `/statement/current/${account}/${currency}`,
        `/statement/pending/${account}/${currency}`,
    ];

    for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${bog.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 200) {
                const data = await response.json();
                console.log(`\n✅ FOUND: ${url}`);
                console.log(`   Keys:`, Object.keys(data));
                if (data.Count || data.count) console.log(`   Count:`, data.Count || data.count);
                if (data.Records || data.records) console.log(`   Has Records: YES`);
                return;
            }
        } catch (e) {}
    }
    
    console.log('\n❌ No alternative endpoints found');
}

findEndpoint().catch(console.error);

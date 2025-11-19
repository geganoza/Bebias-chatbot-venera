#!/usr/bin/env node
/**
 * Test what accounts the BOG API credentials can access
 */

import { BOGClient } from './lib/bogClient.ts';

async function testAccountAccess() {
    console.log('🔍 Testing BOG Account Access');
    console.log('='.repeat(60));

    const clientId = process.env.BOG_CLIENT_ID;
    const clientSecret = process.env.BOG_CLIENT_SECRET;
    const accountId = process.env.BOG_ACCOUNT_ID;
    const environment = process.env.BOG_ENVIRONMENT || 'sandbox';

    if (!clientId || !clientSecret) {
        console.error('❌ Error: BOG_CLIENT_ID and BOG_CLIENT_SECRET must be set');
        process.exit(1);
    }

    console.log(`Environment: ${environment}`);
    console.log(`Testing account: ${accountId}`);
    console.log();

    const bog = new BOGClient({
        clientId,
        clientSecret,
        accountId,
        environment: environment,
    });

    // Test authentication
    console.log('🔐 Step 1: Authenticating...');
    const authenticated = await bog.authenticate();

    if (!authenticated) {
        console.error('❌ Authentication failed');
        process.exit(1);
    }
    console.log('✅ Authenticated successfully');
    console.log();

    // Try to get account info with detailed error
    console.log('💳 Step 2: Testing account access...');
    console.log();

    // Test different account number formats
    const accountTests = [
        accountId,                              // Full: GE73BG0000000539861629GEL
        'GE73BG0000000539861629',              // Without currency
        '0000000539861629',                     // Just the number part
    ];

    for (const testAccount of accountTests) {
        console.log(`Testing: ${testAccount}`);

        try {
            const accountInfo = await bog.getAccountInfo(testAccount);
            if (accountInfo) {
                console.log('✅ SUCCESS! Account found:');
                console.log(`   Balance: ${accountInfo.balance} ${accountInfo.currency}`);
                console.log();
                console.log('🎉 Your credentials CAN access this account!');
                console.log(`   Use this in .env.local: BOG_ACCOUNT_ID="${testAccount}"`);
                process.exit(0);
            }
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
        console.log();
    }

    console.log('='.repeat(60));
    console.log('❌ None of the account formats worked');
    console.log();
    console.log('This means your API credentials are NOT linked to this account.');
    console.log();
    console.log('📝 Next steps:');
    console.log('1. Log in to https://bonline.bog.ge/admin/api');
    console.log('2. Check which accounts are linked to your API application');
    console.log('3. Add account GE73BG0000000539861629 to your API application');
    console.log('4. OR contact BOG support: api-support@bog.ge');
}

testAccountAccess().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

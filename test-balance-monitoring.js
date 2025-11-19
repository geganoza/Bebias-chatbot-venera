#!/usr/bin/env node
/**
 * Monitor account balance changes to detect payments immediately
 *
 * Strategy:
 * 1. Track previous balance
 * 2. Check current balance every minute
 * 3. If balance increased → payment received
 * 4. Match amount to pending orders
 */

import { getBOGClient } from './lib/bogClient.ts';

async function monitorBalance() {
    console.log('💰 Testing Balance Monitoring for Payment Detection');
    console.log('='.repeat(60));

    const bog = getBOGClient();
    await bog.authenticate();

    // Get current balance
    const accountInfo = await bog.getAccountInfo();

    if (accountInfo) {
        console.log('Current Account Balance:');
        console.log(`  Available: ${accountInfo.balance} GEL`);
        console.log();

        console.log('💡 How this works:');
        console.log('1. Store current balance: 7518.4 GEL');
        console.log('2. Customer orders 59 GEL item → Creates order #912345');
        console.log('3. Customer pays → Balance becomes 7577.4 GEL (+59)');
        console.log('4. System detects +59 GEL increase');
        console.log('5. Matches to order #912345 (amount: 59 GEL)');
        console.log('6. Auto-confirms order!');
        console.log();

        console.log('✅ Advantages:');
        console.log('  - Balance updates are IMMEDIATE (real-time)');
        console.log('  - No waiting for statement API');
        console.log('  - Works even if transaction details delayed');
        console.log();

        console.log('⚠️  Limitations:');
        console.log('  - Cannot verify sender name immediately');
        console.log('  - If two customers pay same amount, need manual check');
        console.log('  - Sender name appears in statement later (hours/days)');
        console.log();

        console.log('🎯 Hybrid Solution:');
        console.log('1. IMMEDIATE: Balance change → "Payment received, processing..."');
        console.log('2. DELAYED: Statement API → Verify sender name → Final confirmation');
    }

    console.log('='.repeat(60));
}

monitorBalance().catch(console.error);

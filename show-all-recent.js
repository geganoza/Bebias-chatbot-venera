#!/usr/bin/env node
/**
 * Show all recent transactions with full details
 */

import { getBOGClient } from './lib/bogClient.ts';

async function showAll() {
    const bog = getBOGClient();
    await bog.authenticate();

    console.log('📊 All Recent Transactions (Last 3 days)');
    console.log('='.repeat(60));
    console.log();

    const transactions = await bog.getTransactions(undefined, {
        fromDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        limit: 30,
    });

    console.log(`Total: ${transactions.length} transactions`);
    console.log();

    transactions.forEach((tx, index) => {
        const emoji = tx.type === 'credit' ? '📥 IN' : '📤 OUT';
        console.log(`${emoji} #${index + 1} | ${tx.date.split('T')[0]} | ${tx.amount} ${tx.currency}`);
        console.log(`   Description: ${tx.description}`);
        if (tx.counterpartyName) {
            console.log(`   Sender/Receiver: ${tx.counterpartyName}`);
        }
        if (tx.counterpartyAccount) {
            console.log(`   Account: ${tx.counterpartyAccount}`);
        }
        console.log();
    });
}

showAll().catch(console.error);

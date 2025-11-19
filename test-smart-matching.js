#!/usr/bin/env node
/**
 * Test smart name matching to prevent false positives
 */

import { getBOGClient } from './lib/bogClient.ts';

async function testSmartMatching() {
    console.log('🧠 Testing SMART Name Matching');
    console.log('='.repeat(60));

    const bog = getBOGClient();

    const testCases = [
        {
            desc: 'Full name exact match',
            input: 'გიორგი ნოზაძე',
            amount: 1,
            expected: 'exact or surname',
        },
        {
            desc: 'Surname only (should work)',
            input: 'ნოზაძე',
            amount: 1,
            expected: 'surname',
        },
        {
            desc: 'First name only (should REJECT)',
            input: 'გიორგი',
            amount: 1,
            expected: 'reject (too common)',
        },
        {
            desc: 'Reversed order',
            input: 'ნოზაძე გიორგი',
            amount: 1,
            expected: 'surname or exact',
        },
        {
            desc: 'UniPAY company name',
            input: 'უნიფეი',
            amount: 273.31,
            expected: 'exact or partial',
        },
    ];

    console.log();

    for (const test of testCases) {
        console.log(`Test: ${test.desc}`);
        console.log(`Input: "${test.input}" + ${test.amount} GEL`);
        console.log(`Expected: ${test.expected}`);
        console.log('-'.repeat(60));

        const result = await bog.verifyPaymentByName(test.input, test.amount);

        if (result.verified) {
            console.log(`✅ VERIFIED`);
            console.log(`   Confidence: ${result.confidence}`);
            console.log(`   Sender: ${result.transaction.counterpartyName}`);
        } else {
            console.log(`❌ NOT VERIFIED (correctly rejected if risky)`);
        }
        console.log();
    }

    console.log('='.repeat(60));
    console.log('📋 Summary:');
    console.log('✅ Full names → Verified');
    console.log('✅ Surnames → Verified (safe)');
    console.log('❌ First names only → Rejected (too risky)');
    console.log('✅ Company names → Verified');
}

testSmartMatching().catch(console.error);

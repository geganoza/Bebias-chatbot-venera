// app/api/bank/verify-payment/route.ts

import { NextResponse } from 'next/server';
import { getRecentTransactions, Transaction } from '../../../../lib/bank';
import { matchNames } from '../../../../lib/nameMatching';

export async function POST(request: Request) {
  try {
    const { amount, name } = await request.json();

    if (!amount || !name) {
      return NextResponse.json({ error: 'Amount and name are required' }, { status: 400 });
    }

    console.log(`🔍 Verifying payment: ${amount} GEL from "${name}"`);

    const transactions = await getRecentTransactions();

    console.log(`📋 Checking ${transactions.length} recent transactions`);

    // Find matching transaction using smart name matching
    let matchedTransaction: Transaction | null = null;
    let matchReason = '';

    for (const transaction of transactions) {
      // Check amount match (allow ±0.01 tolerance for rounding)
      const amountMatches = Math.abs(transaction.amount - amount) < 0.01;

      if (amountMatches) {
        const senderName = transaction.senderName || transaction.description || '';
        const nameMatch = matchNames(name, senderName);

        console.log(`  💰 Amount match: ${transaction.amount} GEL`);
        console.log(`  👤 Sender: "${senderName}"`);
        console.log(`  🔎 Name match: ${nameMatch.matched} (${nameMatch.confidence}) - ${nameMatch.reason}`);

        if (nameMatch.matched && nameMatch.confidence !== 'low') {
          matchedTransaction = transaction;
          matchReason = nameMatch.reason;
          break;
        }
      }
    }

    if (matchedTransaction) {
      console.log(`✅ Payment verified: ${amount} GEL from "${matchedTransaction.senderName}"`);
      return NextResponse.json({
        paymentFound: true,
        transaction: matchedTransaction,
        matchReason,
      });
    } else {
      console.log(`❌ No matching payment found`);
      return NextResponse.json({ paymentFound: false });
    }
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    return NextResponse.json({ error: 'Internal server error', paymentFound: false }, { status: 500 });
  }
}

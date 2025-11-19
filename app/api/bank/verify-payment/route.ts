// app/api/bank/verify-payment/route.ts

import { NextResponse } from 'next/server';
import { getRecentTransactions, Transaction } from '../../../../lib/bank';

export async function POST(request: Request) {
  try {
    const { amount, name } = await request.json();

    if (!amount || !name) {
      return NextResponse.json({ error: 'Amount and name are required' }, { status: 400 });
    }

    const transactions = await getRecentTransactions();

    const paymentFound = transactions.some(
      (transaction: Transaction) =>
        transaction.amount === amount &&
        transaction.description.toLowerCase().includes(name.toLowerCase())
    );

    return NextResponse.json({ paymentFound });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

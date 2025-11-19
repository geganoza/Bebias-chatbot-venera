// lib/bank.ts
import { getBOGClient } from './bogClient';

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  senderName?: string;
}

/**
 * Fetches recent transactions from Bank of Georgia (last 10 minutes)
 * Uses real-time todayactivities endpoint for instant payment detection
 */
export async function getRecentTransactions(): Promise<Transaction[]> {
  console.log('🏦 Fetching recent transactions from BOG...');

  try {
    const bog = getBOGClient();
    const transactions = await bog.getTodayActivities();

    // Filter to today's credit transactions only
    // BOG todayactivities returns transactions with time 00:00:00, so we can't filter by minutes
    // All transactions from todayactivities endpoint are by definition "today"
    const recentTransactions = transactions
      .filter(tx => tx.type === 'credit')
      .map(tx => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.counterpartyName || tx.description || 'Unknown',
        senderName: tx.counterpartyName || '',
      }));

    console.log(`✅ Found ${recentTransactions.length} incoming transactions today`);
    return recentTransactions;
  } catch (error) {
    console.error('❌ Error fetching BOG transactions:', error);
    return [];
  }
}

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

    // Filter to last 10 minutes and credit transactions only
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const recentTransactions = transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= tenMinutesAgo && tx.type === 'credit';
      })
      .map(tx => ({
        id: tx.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.counterpartyName || tx.description || 'Unknown',
        senderName: tx.counterpartyName || '',
      }));

    console.log(`✅ Found ${recentTransactions.length} recent transactions (last 10 min)`);
    return recentTransactions;
  } catch (error) {
    console.error('❌ Error fetching BOG transactions:', error);
    return [];
  }
}

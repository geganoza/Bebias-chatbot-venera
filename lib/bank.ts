
// lib/bank.ts

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
}

const BANK_API_URL = process.env.BANK_API_URL;
const BANK_API_TOKEN = process.env.BANK_API_TOKEN;

/**
 * Fetches recent transactions from the bank's API.
 *
 * This is a mock implementation. In a real-world scenario, this function
 * would make a request to the bank's API to fetch real transaction data.
 *
 * @returns {Promise<Transaction[]>} A promise that resolves to a list of transactions.
 */
export async function getRecentTransactions(): Promise<Transaction[]> {
  console.log('Fetching recent transactions from the bank...');

  // In a real implementation, you would use BANK_API_URL and BANK_API_TOKEN
  // to make an authenticated request to the bank's API.
  if (!BANK_API_URL || !BANK_API_TOKEN) {
    console.error('Bank API URL or Token is not set. Please check your .env.local file.');
    return [];
  }

  // Mock data for demonstration purposes
  const mockTransactions: Transaction[] = [
    { id: '1', date: '2025-11-19', amount: 120.50, description: 'Payment from John Doe' },
    { id: '2', date: '2025-11-18', amount: 75.00, description: 'Payment from Jane Smith' },
    { id: '3', date: '2025-11-17', amount: 200.00, description: 'Payment from Foo Bar' },
  ];

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Finished fetching recent transactions.');

  return mockTransactions;
}

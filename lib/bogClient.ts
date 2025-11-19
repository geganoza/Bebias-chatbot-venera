/**
 * Bank of Georgia (BOG) API Client
 * 
 * This module handles authentication and API calls to BOG's banking API
 * to check account transactions and verify bank transfers.
 * 
 * API Documentation: https://developer.bog.ge/
 */

interface BOGConfig {
    clientId: string;
    clientSecret: string;
    accountId?: string;
    environment?: 'sandbox' | 'production';
}

interface BOGAuthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

interface BOGTransaction {
    id: string;
    amount: number;
    currency: string;
    description: string;
    date: string;
    type: 'credit' | 'debit';
    counterpartyName?: string;
    counterpartyAccount?: string;
}

interface BOGAccountInfo {
    accountId: string;
    accountNumber: string;
    currency: string;
    balance: number;
    accountName: string;
}

export class BOGClient {
    private clientId: string;
    private clientSecret: string;
    private accountId?: string;
    private baseUrl: string;
    private accessToken?: string;
    private tokenExpiry?: number;

    constructor(config: BOGConfig) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.accountId = config.accountId;

        // BOG API endpoints
        // Business Online API base URL
        this.baseUrl = 'https://api.businessonline.ge/api';
    }

    /**
     * Authenticate with BOG API and get access token
     */
    async authenticate(): Promise<boolean> {
        try {
            // Check if we have a valid token
            if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return true;
            }

            // Encode credentials for HTTP Basic Auth (client_id:client_secret)
            const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            // BOG Business Online uses a different auth endpoint
            const response = await fetch('https://account.bog.ge/auth/realms/bog/protocol/openid-connect/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`,
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    scope: 'corp', // Business Online scope
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('❌ BOG Authentication failed:', response.status, response.statusText);
                return false;
            }

            const data: BOGAuthResponse = await response.json();
            this.accessToken = data.access_token;
            // Set expiry to 5 minutes before actual expiry for safety
            this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

            console.log('✅ BOG Authentication successful');
            return true;
        } catch (error) {
            console.error('❌ BOG Authentication error:', error);
            return false;
        }
    }

    /**
     * Parse account ID to extract account number and currency
     * Format: GE73BG0000000539861629GEL -> { accountNumber: 'GE73BG0000000539861629', currency: 'GEL' }
     */
    private parseAccountId(accountId: string): { accountNumber: string; currency: string } {
        // Check if currency is appended at the end (e.g., GEL, USD, EUR)
        const match = accountId.match(/^(.+?)(GEL|USD|EUR)$/);
        if (match) {
            return { accountNumber: match[1], currency: match[2] };
        }
        // Default to GEL if no currency suffix found
        return { accountNumber: accountId, currency: 'GEL' };
    }

    /**
     * Get account information
     */
    async getAccountInfo(accountId?: string): Promise<BOGAccountInfo | null> {
        try {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return null;
            }

            const targetAccountId = accountId || this.accountId;
            if (!targetAccountId) {
                console.error('❌ No account ID provided');
                return null;
            }

            const { accountNumber, currency } = this.parseAccountId(targetAccountId);

            const url = `${this.baseUrl}/accounts/${accountNumber}/${currency}`;
            console.log(`📞 Calling: ${url}`);

            // Business Online API: GET api/accounts/{accountNumber}/{currency}
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('❌ Failed to get account info:');
                console.error('Status:', response.status, response.statusText);
                console.error('Response:', error.substring(0, 500));
                return null;
            }

            const data = await response.json();
            console.log('✅ Account info retrieved');

            // Map Business Online response to our interface
            return {
                accountId: targetAccountId,
                accountNumber: accountNumber,
                currency: currency,
                balance: data.AvailableBalance || 0,
                accountName: 'BEBIAS',
            };
        } catch (error) {
            console.error('❌ Error getting account info:', error);
            return null;
        }
    }

    /**
     * Get today's activities (real-time transactions for current day)
     * This endpoint shows transactions immediately without delay
     */
    async getTodayActivities(accountId?: string): Promise<BOGTransaction[]> {
        try {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return [];
            }

            const targetAccountId = accountId || this.accountId;
            if (!targetAccountId) {
                console.error('❌ No account ID provided');
                return [];
            }

            const { accountNumber, currency } = this.parseAccountId(targetAccountId);

            // Real-time endpoint for today's transactions
            // baseUrl is https://api.businessonline.ge/api, we need https://api.businessonline.ge/api/documents/...
            const url = `https://api.businessonline.ge/api/documents/todayactivities/${accountNumber}/${currency}`;
            console.log(`📞 Calling: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('❌ Failed to get today activities:');
                console.error('Status:', response.status, response.statusText);
                console.error('Response:', error.substring(0, 500));
                return [];
            }

            const data = await response.json();

            // Map today activities to our transaction format
            const transactions: BOGTransaction[] = [];
            if (Array.isArray(data)) {
                for (const entry of data) {
                    const isCredit = entry.Credit > 0;
                    const amount = isCredit ? entry.Credit : entry.Debit;

                    transactions.push({
                        id: entry.Id?.toString() || entry.DocKey?.toString() || '',
                        amount: amount || 0,
                        currency: currency,
                        description: entry.EntryComment || entry.Nomination || '',
                        date: entry.PostDate || entry.ValueDate,
                        type: isCredit ? 'credit' : 'debit',
                        counterpartyName: entry.PayerName || entry.Sender?.Name || '',
                        counterpartyAccount: entry.Sender?.AccountNumber || '',
                    });
                }
            }

            console.log(`✅ Retrieved ${transactions.length} today's transactions`);
            return transactions;
        } catch (error) {
            console.error('❌ Error getting today activities:', error);
            return [];
        }
    }

    /**
     * Get account transactions
     */
    async getTransactions(
        accountId?: string,
        options?: {
            fromDate?: string; // ISO date string
            toDate?: string;
            limit?: number;
        }
    ): Promise<BOGTransaction[]> {
        try {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return [];
            }

            const targetAccountId = accountId || this.accountId;
            if (!targetAccountId) {
                console.error('❌ No account ID provided');
                return [];
            }

            const { accountNumber, currency } = this.parseAccountId(targetAccountId);

            // Format dates for Business Online API (YYYY-MM-DD)
            const toDate = options?.toDate ? options.toDate.split('T')[0] : new Date().toISOString().split('T')[0];
            const fromDate = options?.fromDate ? options.fromDate.split('T')[0] :
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 30 days

            // Business Online API: GET api/statement/{accountNumber}/{currency}/{startDate}/{endDate}
            const url = `${this.baseUrl}/statement/${accountNumber}/${currency}/${fromDate}/${toDate}`;
            console.log(`📞 Calling: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('❌ Failed to get transactions:');
                console.error('Status:', response.status, response.statusText);
                console.error('Response:', error.substring(0, 500));
                return [];
            }

            const data = await response.json();

            // Map Business Online statement records to our transaction format
            const transactions: BOGTransaction[] = [];
            if (data.Records && Array.isArray(data.Records)) {
                for (const entry of data.Records.slice(0, options?.limit || 100)) {
                    // Determine if this is a credit (incoming) or debit (outgoing)
                    const isCredit = entry.EntryAmountCredit > 0;
                    const amount = isCredit ? entry.EntryAmountCredit : entry.EntryAmountDebit;

                    // Extract sender/beneficiary name from available fields
                    // BOG API provides sender name in DocumentPayerName or SenderDetails
                    const counterpartyName =
                        entry.DocumentPayerName || // For incoming payments - sender name
                        entry.SenderDetails?.Name || // Sender details object
                        entry.EntryBeneficiaryName || // For outgoing - beneficiary
                        entry.BeneficiaryDetails?.Name || // Beneficiary details object
                        '';

                    transactions.push({
                        id: entry.EntryId || `${entry.EntryDate}_${entry.EntryDocumentNumber}`,
                        amount: amount || 0,
                        currency: currency,
                        description: entry.EntryComment || entry.EntryNomination || '',
                        date: entry.EntryDate,
                        type: isCredit ? 'credit' : 'debit',
                        counterpartyName: counterpartyName,
                        counterpartyAccount: entry.EntryAccountNumber || '',
                    });
                }
            }

            console.log(`✅ Retrieved ${transactions.length} transactions`);
            return transactions;
        } catch (error) {
            console.error('❌ Error getting transactions:', error);
            return [];
        }
    }

    /**
     * Find a transaction by amount and description
     * Useful for verifying bank transfer payments
     */
    async findTransaction(
        amount: number,
        searchTerm: string,
        options?: {
            accountId?: string;
            fromDate?: string;
            toDate?: string;
        }
    ): Promise<BOGTransaction | null> {
        try {
            const transactions = await this.getTransactions(
                options?.accountId,
                {
                    fromDate: options?.fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
                    toDate: options?.toDate,
                    limit: 100,
                }
            );

            // Find matching transaction
            const match = transactions.find(tx =>
                tx.type === 'credit' && // Incoming payment
                Math.abs(tx.amount - amount) < 0.01 && // Amount matches (with small tolerance)
                (
                    tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    tx.counterpartyName?.toLowerCase().includes(searchTerm.toLowerCase())
                )
            );

            if (match) {
                console.log(`✅ Found matching transaction: ${match.id}`);
                return match;
            } else {
                console.log(`ℹ️  No matching transaction found for amount ${amount} with term "${searchTerm}"`);
                return null;
            }
        } catch (error) {
            console.error('❌ Error finding transaction:', error);
            return null;
        }
    }

    /**
     * Verify a bank transfer payment for an order by customer name
     * This searches for payments by amount and customer name (since we don't have customer bank accounts)
     * Uses REAL-TIME today activities first, then falls back to statement API for older transactions
     * Uses smart surname-based matching to avoid false positives from common first names
     */
    async verifyPaymentByName(
        customerName: string,
        expectedAmount: number,
        orderNumber?: string,
        options?: {
            accountId?: string;
            fromDate?: string;
            toDate?: string;
        }
    ): Promise<{ verified: boolean; transaction?: BOGTransaction; confidence?: string }> {
        try {
            const { matchNames } = await import('./nameMatching');

            // STEP 1: Check today's activities first (REAL-TIME)
            console.log('🔍 Checking today\'s activities for real-time data...');
            const todayTransactions = await this.getTodayActivities(options?.accountId);

            // Filter to incoming payments with matching amount
            const candidates = todayTransactions.filter(tx =>
                tx.type === 'credit' && // Incoming payment
                Math.abs(tx.amount - expectedAmount) < 0.01 // Amount matches
            );

            console.log(`Found ${candidates.length} incoming payment(s) with amount ${expectedAmount} GEL`);

            // Search with smart name matching
            let match: BOGTransaction | undefined;
            let matchConfidence: string | undefined;

            for (const tx of candidates) {
                const senderName = tx.counterpartyName || tx.description || '';
                const nameMatch = matchNames(customerName, senderName);

                console.log(`Checking: "${senderName}" vs "${customerName}" → ${nameMatch.confidence} (${nameMatch.reason})`);

                if (nameMatch.matched && nameMatch.confidence !== 'low') {
                    match = tx;
                    matchConfidence = nameMatch.confidence;
                    break;
                }
            }

            // Also check order number in description
            if (!match && orderNumber) {
                match = candidates.find(tx =>
                    tx.description?.toLowerCase().includes(orderNumber.toLowerCase())
                );
                if (match) {
                    matchConfidence = 'order-number';
                }
            }

            if (match) {
                console.log(`✅ Found in today's activities (REAL-TIME): ${match.counterpartyName}: ${match.amount} ${match.currency} (confidence: ${matchConfidence})`);
                return {
                    verified: true,
                    transaction: match,
                    confidence: matchConfidence,
                };
            }

            // STEP 2: If not found in today, check historical statement
            console.log('🔍 Not found in today\'s activities, checking statement history...');
            const transactions = await this.getTransactions(
                options?.accountId,
                {
                    fromDate: options?.fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
                    toDate: options?.toDate,
                    limit: 100,
                }
            );

            // Find matching transaction by customer name and amount
            match = transactions.find(tx =>
                tx.type === 'credit' && // Incoming payment
                Math.abs(tx.amount - expectedAmount) < 0.01 && // Amount matches (with small tolerance)
                (
                    // Match by sender name (in counterpartyName field)
                    tx.counterpartyName?.toLowerCase().includes(customerName.toLowerCase()) ||
                    // OR match by name in description (BOG often puts sender name here)
                    tx.description?.toLowerCase().includes(customerName.toLowerCase()) ||
                    // OR match by order number in description
                    (orderNumber && tx.description?.toLowerCase().includes(orderNumber.toLowerCase()))
                )
            );

            if (match) {
                console.log(`✅ Found matching payment from ${match.counterpartyName}: ${match.amount} ${match.currency}`);
                return {
                    verified: true,
                    transaction: match,
                };
            } else {
                console.log(`ℹ️  No matching payment found for ${customerName} with amount ${expectedAmount}`);
                return {
                    verified: false,
                };
            }
        } catch (error) {
            console.error('❌ Error verifying payment:', error);
            return {
                verified: false,
            };
        }
    }

    /**
     * Verify a bank transfer payment for an order (legacy - searches by order number only)
     */
    async verifyPayment(
        orderNumber: string,
        expectedAmount: number,
        options?: {
            accountId?: string;
            fromDate?: string;
            toDate?: string;
        }
    ): Promise<{ verified: boolean; transaction?: BOGTransaction }> {
        try {
            // Search for transaction with order number in description
            const transaction = await this.findTransaction(
                expectedAmount,
                orderNumber,
                options
            );

            if (transaction) {
                return {
                    verified: true,
                    transaction,
                };
            }

            return {
                verified: false,
            };
        } catch (error) {
            console.error('❌ Error verifying payment:', error);
            return {
                verified: false,
            };
        }
    }
}

// Export singleton instance
let bogClient: BOGClient | null = null;

export function getBOGClient(): BOGClient {
    if (!bogClient) {
        const clientId = process.env.BOG_CLIENT_ID;
        const clientSecret = process.env.BOG_CLIENT_SECRET;
        const accountId = process.env.BOG_ACCOUNT_ID;
        const environment = (process.env.BOG_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

        if (!clientId || !clientSecret) {
            throw new Error('BOG_CLIENT_ID and BOG_CLIENT_SECRET must be set in environment variables');
        }

        bogClient = new BOGClient({
            clientId,
            clientSecret,
            accountId,
            environment,
        });
    }

    return bogClient;
}

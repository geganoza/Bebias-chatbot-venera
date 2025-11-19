/**
 * Smart Name Matching for Payment Verification
 * Prioritizes surname matching to avoid false positives from common first names
 */

import { parseGeorgianName } from './georgianNames';

export interface NameMatchResult {
    matched: boolean;
    confidence: 'exact' | 'surname' | 'full-partial' | 'low';
    reason: string;
}

/**
 * Match customer name against payment sender name
 *
 * Strategy:
 * 1. BEST: Exact full name match → confidence: 'exact'
 * 2. GOOD: Surname match (both ways) → confidence: 'surname'
 * 3. OK: Both first name AND surname found → confidence: 'full-partial'
 * 4. RISKY: Only first name match → confidence: 'low' (reject to avoid errors)
 */
export function matchNames(customerName: string, paymentSenderName: string): NameMatchResult {
    const customerLower = customerName.toLowerCase().trim();
    const senderLower = paymentSenderName.toLowerCase().trim();

    // 1. Exact match
    if (customerLower === senderLower) {
        return {
            matched: true,
            confidence: 'exact',
            reason: 'Exact full name match',
        };
    }

    // Parse both names
    const customer = parseGeorgianName(customerName);
    const sender = parseGeorgianName(paymentSenderName);

    // 2. Surname match (highest priority after exact match)
    const customerSurnameLower = customer.surname.toLowerCase();
    const senderSurnameLower = sender.surname.toLowerCase();

    if (customerSurnameLower && senderSurnameLower) {
        // Exact surname match
        if (customerSurnameLower === senderSurnameLower) {
            return {
                matched: true,
                confidence: 'surname',
                reason: `Surname match: "${customer.surname}"`,
            };
        }

        // Surname contains (for cases like "ნოზაძე" vs "გიორგი ნოზაძე")
        // BUT only if customer provided surname (not just first name)
        if (customer.parsed && senderLower.includes(customerSurnameLower)) {
            return {
                matched: true,
                confidence: 'surname',
                reason: `Surname found: "${customer.surname}"`,
            };
        }

        if (sender.parsed && customerLower.includes(senderSurnameLower)) {
            return {
                matched: true,
                confidence: 'surname',
                reason: `Surname found: "${customer.surname}"`,
            };
        }
    }

    // 3. Check if both parts are present (first name AND surname)
    const customerFirstLower = customer.firstName.toLowerCase();
    const senderFirstLower = sender.firstName.toLowerCase();

    const hasFirstName = customerFirstLower && (
        senderLower.includes(customerFirstLower) ||
        customerLower.includes(senderFirstLower)
    );

    const hasSurname = customerSurnameLower && (
        senderLower.includes(customerSurnameLower) ||
        customerLower.includes(senderSurnameLower)
    );

    if (hasFirstName && hasSurname) {
        return {
            matched: true,
            confidence: 'full-partial',
            reason: `Both name parts found: "${customer.firstName} ${customer.surname}"`,
        };
    }

    // 4. Only first name match - TOO RISKY, reject
    if (hasFirstName && !hasSurname) {
        return {
            matched: false,
            confidence: 'low',
            reason: `Only first name match - too many people named "${customer.firstName}". Please provide full name.`,
        };
    }

    // No match
    return {
        matched: false,
        confidence: 'low',
        reason: 'Name does not match',
    };
}

/**
 * Filter transactions by customer name with smart matching
 */
export function findMatchingTransaction<T extends { counterpartyName?: string; description?: string }>(
    transactions: T[],
    customerName: string
): { transaction: T; matchResult: NameMatchResult } | null {
    for (const tx of transactions) {
        const senderName = tx.counterpartyName || tx.description || '';
        const matchResult = matchNames(customerName, senderName);

        // Accept only high-confidence matches
        if (matchResult.matched && matchResult.confidence !== 'low') {
            return { transaction: tx, matchResult };
        }
    }

    return null;
}

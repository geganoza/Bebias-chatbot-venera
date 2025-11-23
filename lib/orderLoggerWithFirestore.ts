import { OrderData } from './sendOrderEmail';
import { db } from './firestore';
import {
    updateProductStock,
    reserveStock,
    confirmReservation,
    cancelReservation,
    checkProductAvailability,
} from './firestoreSync';

// Warehouse app webhook URL - pushes orders automatically
const WAREHOUSE_WEBHOOK_URL = process.env.WAREHOUSE_WEBHOOK_URL || 'https://order-manager-giorgis-projects-cea59354.vercel.app/api/webhook';

/**
 * Push order to warehouse app via webhook
 * Non-blocking - errors are logged but don't affect order creation
 */
async function pushToWarehouse(order: OrderLog): Promise<void> {
    try {
        // Map our order format to warehouse webhook format
        const warehousePayload = {
            externalId: order.orderNumber,
            customerName: order.clientName,
            customerPhone: order.telephone,
            customerAddress: order.address,
            city: extractCity(order.address),
            productName: order.product,
            quantity: parseInt(order.quantity) || 1,
            notes: `Messenger order. Payment: ${order.paymentMethod || 'cash_on_delivery'}`
        };

        console.log(`📦 Pushing order ${order.orderNumber} to warehouse...`);

        const response = await fetch(WAREHOUSE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(warehousePayload),
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ Order ${order.orderNumber} pushed to warehouse`);

            // Mark as synced in Firestore
            await db.collection('orders').doc(order.orderNumber).update({
                warehousePushed: true,
                warehousePushedAt: new Date().toISOString(),
            });
        } else {
            console.error(`⚠️ Warehouse push failed (${response.status})`);
        }
    } catch (error) {
        console.error(`⚠️ Warehouse push error (non-blocking):`, error);
    }
}

/**
 * Extract city from Georgian address
 */
function extractCity(address: string): string {
    const cities: [RegExp, string][] = [
        [/თბილის/i, 'თბილისი'],
        [/ბათუმ/i, 'ბათუმი'],
        [/ქუთაის/i, 'ქუთაისი'],
        [/რუსთავ/i, 'რუსთავი'],
    ];
    for (const [pattern, city] of cities) {
        if (pattern.test(address)) return city;
    }
    return 'თბილისი';
}

export interface OrderLog extends OrderData {
    orderNumber: string;
    timestamp: string;
    source: 'messenger' | 'chat';
    paymentMethod?: 'bank_transfer' | 'cash_on_delivery';
    paymentStatus?: 'pending' | 'confirmed' | 'failed';
    firestoreUpdated?: boolean;
    productSku?: string;     // Document ID = product name (for stock updates)
    productId?: string;      // WooCommerce ID (for syncing with WC)
}

// Generate order number based on source using Firestore counter
// Messenger: 9 + 5 digits (e.g., 900001)
// Chat: 8 + 5 digits (e.g., 800001)
async function generateOrderNumber(source: 'messenger' | 'chat'): Promise<string> {
    const prefix = source === 'messenger' ? '9' : '8';
    const counterDoc = `orderCounter_${source}`;

    try {
        // Use Firestore transaction to atomically increment counter
        const counterRef = db.collection('counters').doc(counterDoc);

        const newNumber = await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(counterRef);

            let currentNumber = 0;
            if (doc.exists) {
                currentNumber = doc.data()?.value || 0;
            }

            const nextNumber = currentNumber + 1;
            transaction.set(counterRef, { value: nextNumber, updatedAt: new Date().toISOString() });

            return nextNumber;
        });

        // Pad with zeros to make it 5 digits
        const orderNumber = `${prefix}${String(newNumber).padStart(5, '0')}`;
        console.log(`✅ Generated order number: ${orderNumber}`);
        return orderNumber;
    } catch (error) {
        console.error('❌ Error generating order number:', error);
        // Fallback: use timestamp-based number
        const timestamp = Date.now().toString().slice(-5);
        return `${prefix}${timestamp}`;
    }
}

interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
}

/**
 * Extract product document ID from product name
 * Document ID = product name (sanitized)
 * Prefers variations (actual sellable products) over variable parents
 * Returns { docId, wcId } for both stock updates and WC reference
 */
async function extractProductInfo(productName: string): Promise<{ docId: string; wcId: string | null } | null> {
    try {
        // Get all products from Firestore
        const snapshot = await db.collection('products').get();

        interface FirestoreProduct {
            docId: string;  // Document ID = product name
            wcId?: string;  // WooCommerce ID
            name?: string;
            type?: string;
            price?: number;
            stock_qty?: number;
        }

        const products: FirestoreProduct[] = snapshot.docs.map(doc => ({
            docId: doc.id,  // Document ID = product name
            wcId: doc.data().id,  // WooCommerce ID field
            name: doc.data().name,
            type: doc.data().type,
            price: doc.data().price,
            stock_qty: doc.data().stock_qty
        }));

        // Normalize product name for comparison (lowercase, trim)
        const normalizedInput = productName.toLowerCase().trim();

        // Find matching products - flexible matching for Georgian product names
        // Handles cases where AI might use shortened names like "შავი ბამბის ქუდი" instead of "შავი ბამბის მოკლე ქუდი"
        const matches = products.filter(p => {
            const pName = p.name?.toLowerCase().trim() || '';
            const docId = p.docId?.toLowerCase().trim() || '';

            // Exact match on name or doc ID
            if (pName === normalizedInput || docId === normalizedInput) return true;

            // Name starts with input (e.g., input "შავი ბამბის" matches "შავი ბამბის მოკლე ქუდი")
            if (pName.startsWith(normalizedInput) || docId.startsWith(normalizedInput)) return true;

            // Input starts with name (e.g., input "შავი ბამბის მოკლე ქუდი სტანდარტი" matches "შავი ბამბის მოკლე ქუდი")
            if (normalizedInput.startsWith(pName) && pName.length > 10) return true;

            // FUZZY: Check if all words in input appear in product name (handles "შავი ბამბის ქუდი" matching "შავი ბამბის მოკლე ქუდი")
            const inputWords = normalizedInput.split(/\s+/).filter(w => w.length > 2);
            const nameWords = pName.split(/\s+/);
            const allWordsMatch = inputWords.every(inputWord =>
                nameWords.some(nameWord => nameWord.includes(inputWord) || inputWord.includes(nameWord))
            );
            if (allWordsMatch && inputWords.length >= 2) return true;

            return false;
        });

        if (matches.length === 0) {
            console.warn(`⚠️ No product found for: "${productName}"`);
            return null;
        }

        // Sort matches: prefer variations with price > 0, then by exact match
        matches.sort((a, b) => {
            // Prefer variation over variable (parent)
            if (a.type === 'variation' && b.type !== 'variation') return -1;
            if (b.type === 'variation' && a.type !== 'variation') return 1;
            // Prefer products with price > 0
            if ((a.price || 0) > 0 && (b.price || 0) === 0) return -1;
            if ((b.price || 0) > 0 && (a.price || 0) === 0) return 1;
            // Prefer exact name match
            if (a.name?.toLowerCase().trim() === normalizedInput) return -1;
            if (b.name?.toLowerCase().trim() === normalizedInput) return 1;
            return 0;
        });

        const match = matches[0];
        console.log(`✅ Found product: "${match.docId}" (WC ID: ${match.wcId}, type: ${match.type}, price: ${match.price}, stock: ${match.stock_qty})`);
        return {
            docId: match.docId,  // Document ID for stock updates
            wcId: match.wcId || null  // WooCommerce ID for reference
        };
    } catch (error) {
        console.error('Error loading products:', error);
        return null;
    }
}

export async function logOrder(
    orderData: OrderData,
    source: 'messenger' | 'chat',
    options?: {
        paymentMethod?: 'bank_transfer' | 'cash_on_delivery';
        productSku?: string;
        productId?: string;
        quantity?: number;
    }
): Promise<string> {
    try {
        const orderNumber = await generateOrderNumber(source);
        const timestamp = new Date().toISOString();
        const paymentMethod = options?.paymentMethod || 'cash_on_delivery';

        // Get product info (docId for stock, wcId for WooCommerce reference)
        let productSku = options?.productSku;
        let productId = options?.productId;

        if (!productSku) {
            const productInfo = await extractProductInfo(orderData.product);
            if (productInfo) {
                productSku = productInfo.docId;
                productId = productInfo.wcId || undefined;
            }
        }

        // Use options quantity, or parse from orderData, default to 1
        const quantityNum = options?.quantity || parseInt(orderData.quantity) || 1;

        let firestoreUpdated = false;
        let paymentStatus: 'pending' | 'confirmed' | 'failed' = 'pending';

        // Handle stock update based on payment method
        if (productSku) {
            if (paymentMethod === 'bank_transfer') {
                // Reserve stock for bank transfer (will be confirmed later)
                const reserved = await reserveStock(productSku, quantityNum, orderNumber, 30);
                if (reserved) {
                    console.log(`📦 Stock reserved for order ${orderNumber} (awaiting payment)`);
                }
            } else {
                // Cash on delivery - update stock immediately
                const updated = await updateProductStock(productSku, quantityNum, orderNumber);
                firestoreUpdated = updated;
                paymentStatus = updated ? 'confirmed' : 'failed';
            }
        }

        const orderLog: OrderLog = {
            ...orderData,
            orderNumber,
            timestamp,
            source,
            paymentMethod,
            paymentStatus,
            firestoreUpdated,
            productSku: productSku || undefined,
            productId: productId || undefined,  // WooCommerce ID for syncing
        };

        // Save to Firestore orders collection
        await db.collection('orders').doc(orderNumber).set(orderLog);

        console.log(`✅ Order logged to Firestore: ${orderNumber}`);

        // Push to warehouse app (non-blocking)
        pushToWarehouse(orderLog).catch(err =>
            console.error(`⚠️ Warehouse push error:`, err)
        );

        return orderNumber;
    } catch (error) {
        console.error('❌ Error logging order:', error);
        throw error;
    }
}

/**
 * Confirm bank transfer payment and update stock
 */
export async function confirmBankTransfer(
    orderNumber: string
): Promise<boolean> {
    try {
        // Get order directly from Firestore
        const orderDoc = await db.collection('orders').doc(orderNumber).get();

        if (!orderDoc.exists) {
            console.error(`❌ Order ${orderNumber} not found`);
            return false;
        }

        const order = orderDoc.data() as OrderLog;

        if (order.paymentMethod !== 'bank_transfer') {
            console.error(`❌ Order ${orderNumber} is not a bank transfer`);
            return false;
        }

        if (order.paymentStatus === 'confirmed') {
            console.log(`ℹ️  Order ${orderNumber} already confirmed`);
            return true;
        }

        // Confirm reservation and update stock
        if (order.productSku) {
            const confirmed = await confirmReservation(orderNumber, order.productSku);

            if (confirmed) {
                // Update order in Firestore
                await updateOrderStatus(orderNumber, 'confirmed', true);
                console.log(`✅ Bank transfer confirmed for order ${orderNumber}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`❌ Error confirming bank transfer:`, error);
        return false;
    }
}

/**
 * Cancel bank transfer (payment failed or expired)
 */
export async function cancelBankTransfer(
    orderNumber: string
): Promise<boolean> {
    try {
        // Get order directly from Firestore
        const orderDoc = await db.collection('orders').doc(orderNumber).get();

        if (!orderDoc.exists) {
            console.error(`❌ Order ${orderNumber} not found`);
            return false;
        }

        const order = orderDoc.data() as OrderLog;

        if (order.productSku) {
            const cancelled = await cancelReservation(orderNumber, order.productSku);

            if (cancelled) {
                await updateOrderStatus(orderNumber, 'failed', false);
                console.log(`❌ Bank transfer cancelled for order ${orderNumber}`);
                return true;
            }
        }

        return false;
    } catch (error) {
        console.error(`❌ Error cancelling bank transfer:`, error);
        return false;
    }
}

/**
 * Update order status in Firestore
 */
async function updateOrderStatus(
    orderNumber: string,
    paymentStatus: 'pending' | 'confirmed' | 'failed',
    firestoreUpdated: boolean
): Promise<void> {
    await db.collection('orders').doc(orderNumber).update({
        paymentStatus,
        firestoreUpdated,
        updatedAt: new Date().toISOString()
    });
}

// Helper function to read all orders from Firestore
export async function readOrders(): Promise<OrderLog[]> {
    try {
        const snapshot = await db.collection('orders').orderBy('timestamp', 'desc').limit(100).get();
        return snapshot.docs.map(doc => doc.data() as OrderLog);
    } catch (error) {
        console.error('❌ Error reading orders from Firestore:', error);
        return [];
    }
}

/**
 * Check product availability before creating order
 */
export async function checkOrderAvailability(
    productSku: string,
    quantity: number = 1
): Promise<{ available: boolean; currentStock: number; message: string }> {
    const result = await checkProductAvailability(productSku, quantity);

    let message = '';
    if (!result.available) {
        if (result.currentStock === 0) {
            message = 'პროდუქტი არ არის მარაგში';
        } else {
            message = `მარაგში არის მხოლოდ ${result.currentStock} ცალი`;
        }
    } else {
        message = 'პროდუქტი ხელმისაწვდომია';
    }

    return {
        ...result,
        message,
    };
}

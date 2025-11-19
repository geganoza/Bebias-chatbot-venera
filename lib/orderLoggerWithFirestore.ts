import fs from 'fs/promises';
import path from 'path';
import { OrderData } from './sendOrderEmail';
import {
    updateProductStock,
    reserveStock,
    confirmReservation,
    cancelReservation,
    checkProductAvailability,
} from './firestoreSync';

export interface OrderLog extends OrderData {
    orderNumber: string;
    timestamp: string;
    source: 'messenger' | 'chat';
    paymentMethod?: 'bank_transfer' | 'cash_on_delivery';
    paymentStatus?: 'pending' | 'confirmed' | 'failed';
    firestoreUpdated?: boolean;
    productSku?: string;
    quantity?: number;
}

// Generate order number based on source
// Messenger: 9 + 5 digits (e.g., 912345)
// Chat: 8 + 5 digits (e.g., 812345)
async function generateOrderNumber(source: 'messenger' | 'chat'): Promise<string> {
    const prefix = source === 'messenger' ? '9' : '8';

    // Read existing orders to get the last order number
    const logFile = path.join(process.cwd(), 'data', 'orders.log');

    try {
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            // First order
            return `${prefix}00001`;
        }

        // Find the last order number with the same prefix
        const orders = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        }).filter(Boolean) as OrderLog[];

        const lastOrderWithPrefix = orders
            .filter(order => order.orderNumber.startsWith(prefix))
            .pop();

        if (!lastOrderWithPrefix) {
            // First order with this prefix
            return `${prefix}00001`;
        }

        // Increment the last order number
        const lastNumber = parseInt(lastOrderWithPrefix.orderNumber.substring(1));
        const nextNumber = lastNumber + 1;

        // Pad with zeros to make it 5 digits
        return `${prefix}${String(nextNumber).padStart(5, '0')}`;
    } catch (error) {
        // File doesn't exist yet, start with first order
        return `${prefix}00001`;
    }
}

/**
 * Extract product SKU from product name
 * This assumes the product name in the order matches the chatbot's products.json
 */
function extractProductSku(productName: string): string | null {
    // You may need to customize this based on your product naming
    // For now, we'll try to match against products.json
    // This is a placeholder - you should implement proper SKU extraction
    return null; // Will be set manually or from product selection
}

export async function logOrder(
    orderData: OrderData,
    source: 'messenger' | 'chat',
    options?: {
        paymentMethod?: 'bank_transfer' | 'cash_on_delivery';
        productSku?: string;
        quantity?: number;
    }
): Promise<string> {
    try {
        const orderNumber = await generateOrderNumber(source);
        const timestamp = new Date().toISOString();
        const paymentMethod = options?.paymentMethod || 'cash_on_delivery';
        const productSku = options?.productSku || extractProductSku(orderData.product);
        const quantity = options?.quantity || 1;

        let firestoreUpdated = false;
        let paymentStatus: 'pending' | 'confirmed' | 'failed' = 'pending';

        // Handle stock update based on payment method
        if (productSku) {
            if (paymentMethod === 'bank_transfer') {
                // Reserve stock for bank transfer (will be confirmed later)
                const reserved = await reserveStock(productSku, quantity, orderNumber, 30);
                if (reserved) {
                    console.log(`📦 Stock reserved for order ${orderNumber} (awaiting payment)`);
                }
            } else {
                // Cash on delivery - update stock immediately
                const updated = await updateProductStock(productSku, quantity, orderNumber);
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
            quantity,
        };

        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }

        // Append to log file (JSON lines format)
        const logFile = path.join(dataDir, 'orders.log');
        const logLine = JSON.stringify(orderLog) + '\n';

        await fs.appendFile(logFile, logLine, 'utf-8');

        console.log(`✅ Order logged: ${orderNumber}`);
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
        // Read order from log
        const orders = await readOrders();
        const order = orders.find(o => o.orderNumber === orderNumber);

        if (!order) {
            console.error(`❌ Order ${orderNumber} not found`);
            return false;
        }

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
                // Update order log
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
        const orders = await readOrders();
        const order = orders.find(o => o.orderNumber === orderNumber);

        if (!order) {
            console.error(`❌ Order ${orderNumber} not found`);
            return false;
        }

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
 * Update order status in the log file
 */
async function updateOrderStatus(
    orderNumber: string,
    paymentStatus: 'pending' | 'confirmed' | 'failed',
    firestoreUpdated: boolean
): Promise<void> {
    const logFile = path.join(process.cwd(), 'data', 'orders.log');
    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n');

    const updatedLines = lines.map(line => {
        try {
            const order = JSON.parse(line) as OrderLog;
            if (order.orderNumber === orderNumber) {
                order.paymentStatus = paymentStatus;
                order.firestoreUpdated = firestoreUpdated;
                return JSON.stringify(order);
            }
            return line;
        } catch {
            return line;
        }
    });

    await fs.writeFile(logFile, updatedLines.join('\n') + '\n', 'utf-8');
}

// Helper function to read all orders
export async function readOrders(): Promise<OrderLog[]> {
    try {
        const logFile = path.join(process.cwd(), 'data', 'orders.log');
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());

        return lines.map(line => {
            try {
                return JSON.parse(line) as OrderLog;
            } catch {
                return null;
            }
        }).filter(Boolean) as OrderLog[];
    } catch (error) {
        console.error('❌ Error reading orders:', error);
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

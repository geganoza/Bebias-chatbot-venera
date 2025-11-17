import fs from 'fs/promises';
import path from 'path';
import { OrderData } from './sendOrderEmail';

export interface OrderLog extends OrderData {
  orderNumber: string;
  timestamp: string;
  source: 'messenger' | 'chat';
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

export async function logOrder(
  orderData: OrderData,
  source: 'messenger' | 'chat'
): Promise<string> {
  try {
    const orderNumber = await generateOrderNumber(source);
    const timestamp = new Date().toISOString();

    const orderLog: OrderLog = {
      ...orderData,
      orderNumber,
      timestamp,
      source,
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

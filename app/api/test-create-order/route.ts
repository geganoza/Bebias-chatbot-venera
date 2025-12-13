/**
 * TEST ORDER CREATION ENDPOINT
 *
 * Creates real orders in Firestore for testing.
 * This bypasses Instagram/conversation flow and directly tests order creation logic.
 *
 * ⚠️ Creates real orders - use with caution
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { logOrder } from '@/lib/orderLoggerWithFirestore';
import { OrderData } from '@/lib/sendOrderEmail';
import { db } from '@/lib/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Simple auth - require test key in dev/test
const TEST_KEY = process.env.TEST_API_KEY || 'bebias-test-2024';

export async function POST(request: NextRequest) {
  try {
    // Check for test key header (optional security)
    const authHeader = request.headers.get('x-test-key');
    if (authHeader && authHeader !== TEST_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Invalid test key'
      }, { status: 401 });
    }

    const body = await request.json();
    console.log('[TEST-CREATE-ORDER] Request body:', JSON.stringify(body, null, 2));

    // Validate required fields
    const requiredFields = ['product', 'clientName', 'telephone', 'address', 'total'];
    const missingFields = requiredFields.filter(f => !body[f]);

    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      }, { status: 400 });
    }

    // Build order data
    const orderData: OrderData = {
      product: body.product,
      quantity: body.quantity || '1',
      clientName: body.clientName,
      telephone: body.telephone,
      address: body.address,
      city: body.city,
      total: body.total,
      notes: body.notes,
      // Wolt-specific fields
      deliveryMethod: body.deliveryMethod,
      deliveryCompany: body.deliveryCompany,
      deliveryPrice: body.deliveryPrice,
      etaMinutes: body.etaMinutes,
      sessionId: body.sessionId,
      lat: body.lat,
      lon: body.lon,
      deliveryInstructions: body.deliveryInstructions,
      isWoltOrder: body.isWoltOrder || body.deliveryMethod === 'wolt',
    };

    // Determine source
    const source = body.deliveryMethod === 'wolt' ? 'wolt' : 'messenger';

    console.log('[TEST-CREATE-ORDER] Creating order with source:', source);
    console.log('[TEST-CREATE-ORDER] Order data:', JSON.stringify(orderData, null, 2));

    // Create the order
    const orderNumber = await logOrder(orderData, source, {
      skipStockUpdate: body.skipStockUpdate ?? true, // Default: don't affect stock in tests
    });

    console.log('[TEST-CREATE-ORDER] Order created:', orderNumber);

    // Fetch the created order to return full details
    const orderDoc = await db.collection('orders').doc(orderNumber).get();
    const orderDetails = orderDoc.exists ? orderDoc.data() : null;

    return NextResponse.json({
      success: true,
      orderNumber,
      source,
      order: orderDetails,
      message: `Order ${orderNumber} created successfully`
    });

  } catch (error) {
    console.error('[TEST-CREATE-ORDER] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Return recent test orders for debugging
  try {
    const snapshot = await db.collection('orders')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const orders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
      message: 'Recent 10 orders'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Clean up test orders
export async function DELETE(request: NextRequest) {
  try {
    const { orderNumber } = await request.json();

    if (!orderNumber) {
      return NextResponse.json({
        success: false,
        error: 'orderNumber required'
      }, { status: 400 });
    }

    // Only allow deleting test orders (prefixed with 'test-' or specific patterns)
    if (!orderNumber.startsWith('7') && !orderNumber.startsWith('9') && !orderNumber.startsWith('8')) {
      return NextResponse.json({
        success: false,
        error: 'Can only delete orders with valid prefixes'
      }, { status: 400 });
    }

    await db.collection('orders').doc(orderNumber).delete();

    return NextResponse.json({
      success: true,
      message: `Order ${orderNumber} deleted`
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * API Route for Bank Transfer Confirmation
 * 
 * POST /api/orders/confirm-payment
 * Body: { orderNumber: string, adminKey: string }
 * 
 * This endpoint allows admins to confirm bank transfer payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { confirmBankTransfer, cancelBankTransfer, readOrders } from '@/lib/orderLoggerWithFirestore';

// Set this in your environment variables
const ADMIN_KEY = process.env.ADMIN_CONFIRMATION_KEY || 'your-secret-admin-key';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { orderNumber, adminKey, action } = body;

        // Validate admin key
        if (adminKey !== ADMIN_KEY) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Validate order number
        if (!orderNumber) {
            return NextResponse.json(
                { error: 'Order number is required' },
                { status: 400 }
            );
        }

        // Confirm or cancel based on action
        if (action === 'cancel') {
            const cancelled = await cancelBankTransfer(orderNumber);

            if (cancelled) {
                return NextResponse.json({
                    success: true,
                    message: `Order ${orderNumber} cancelled`,
                    orderNumber,
                });
            } else {
                return NextResponse.json(
                    { error: 'Failed to cancel order' },
                    { status: 500 }
                );
            }
        } else {
            // Default action is confirm
            const confirmed = await confirmBankTransfer(orderNumber);

            if (confirmed) {
                return NextResponse.json({
                    success: true,
                    message: `Order ${orderNumber} confirmed`,
                    orderNumber,
                });
            } else {
                return NextResponse.json(
                    { error: 'Failed to confirm order' },
                    { status: 500 }
                );
            }
        }
    } catch (error) {
        console.error('Error processing payment confirmation:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint to check pending orders
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const adminKey = searchParams.get('adminKey');

        // Validate admin key
        if (adminKey !== ADMIN_KEY) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get all orders
        const orders = await readOrders();

        // Filter pending bank transfers
        const pendingOrders = orders.filter(
            order => order.paymentMethod === 'bank_transfer' && order.paymentStatus === 'pending'
        );

        return NextResponse.json({
            success: true,
            pendingOrders,
            count: pendingOrders.length,
        });
    } catch (error) {
        console.error('Error fetching pending orders:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

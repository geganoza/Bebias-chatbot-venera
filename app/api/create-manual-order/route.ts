import { NextResponse } from 'next/server';
import { logOrder } from '@/lib/orderLoggerWithFirestore';
import { OrderData, sendOrderEmail } from '@/lib/sendOrderEmail';
import fs from 'fs/promises';
import path from 'path';

// Load products from JSON file to get prices
async function loadProducts(): Promise<any[]> {
  try {
    const file = path.join(process.cwd(), 'data', 'products.json');
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch (err) {
    console.error('❌ Error loading products:', err);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { products, customerName, telephone, address, notes } = body;

    // Validate required fields
    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: 'At least one product is required' },
        { status: 400 }
      );
    }

    if (!customerName || !telephone || !address) {
      return NextResponse.json(
        { error: 'Customer name, telephone, and address are required' },
        { status: 400 }
      );
    }

    console.log('📝 Creating manual order...');
    console.log('Products:', products);
    console.log('Customer:', customerName);

    // Load product catalog to get prices
    const productCatalog = await loadProducts();

    const createdOrders = [];

    // Create order for each product (same as bot does)
    for (const product of products) {
      // Find product in catalog to get price
      let total = '0 ლარი';
      const catalogProduct = productCatalog.find(p =>
        p.name.toLowerCase().includes(product.name.toLowerCase()) ||
        product.name.toLowerCase().includes(p.name.toLowerCase())
      );

      if (catalogProduct) {
        const price = parseFloat(catalogProduct.price) || 0;
        const quantity = product.quantity || 1;
        const totalAmount = price * quantity;
        total = `${totalAmount} ${catalogProduct.currency || 'ლარი'}`;
        console.log(`💰 Calculated total for ${product.name}: ${total} (${price} x ${quantity})`);
      } else {
        console.warn(`⚠️ Product not found in catalog: ${product.name}, using default total`);
      }

      const orderData: OrderData = {
        product: product.name,
        quantity: String(product.quantity || 1),
        clientName: customerName,
        telephone: telephone,
        address: address,
        total: total
      };

      console.log(`📦 Creating order for: ${product.name} x ${product.quantity || 1}`);

      try {
        // Use the existing order logger with 'chat' source for manual orders
        // Payment is already confirmed via instant bank transfer
        const orderNumber = await logOrder(orderData, 'chat');

        console.log(`✅ Order created: ${orderNumber}`);

        // Send email notification
        try {
          await sendOrderEmail(orderData, orderNumber);
          console.log(`📧 Email sent for order ${orderNumber}`);
        } catch (emailError: any) {
          console.error(`❌ Failed to send email for order ${orderNumber}:`, emailError.message);
        }

        createdOrders.push({
          orderNumber,
          product: product.name,
          quantity: product.quantity || 1,
          status: 'success'
        });

      } catch (error: any) {
        console.error(`❌ Failed to create order for ${product.name}:`, error);
        createdOrders.push({
          product: product.name,
          quantity: product.quantity || 1,
          status: 'failed',
          error: error.message
        });
      }
    }

    // Check if all orders failed
    const allFailed = createdOrders.every(o => o.status === 'failed');
    if (allFailed) {
      return NextResponse.json(
        {
          error: 'All orders failed to create',
          details: createdOrders
        },
        { status: 500 }
      );
    }

    console.log(`✅ Manual order creation complete. ${createdOrders.filter(o => o.status === 'success').length}/${createdOrders.length} successful`);

    return NextResponse.json({
      success: true,
      orders: createdOrders,
      notes: notes || null
    });

  } catch (error: any) {
    console.error('❌ Error creating manual order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create manual order' },
      { status: 500 }
    );
  }
}

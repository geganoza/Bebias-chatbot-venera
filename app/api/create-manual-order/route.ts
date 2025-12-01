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

    // Build combined order data
    let totalAmount = 0;
    const productDescriptions: string[] = [];
    const productQuantities: number[] = [];

    // Calculate total and build product description
    for (const product of products) {
      const quantity = product.quantity || 1;

      // Find product in catalog to get price
      const catalogProduct = productCatalog.find(p =>
        p.name.toLowerCase().includes(product.name.toLowerCase()) ||
        product.name.toLowerCase().includes(p.name.toLowerCase())
      );

      if (catalogProduct) {
        const price = parseFloat(catalogProduct.price) || 0;
        totalAmount += price * quantity;
        console.log(`💰 ${product.name}: ${price} x ${quantity} = ${price * quantity} ლარი`);
      } else {
        console.warn(`⚠️ Product not found in catalog: ${product.name}`);
      }

      // Add to product description (like bot does: "product x quantity")
      productDescriptions.push(`${product.name} x ${quantity}`);
      productQuantities.push(quantity);
    }

    // Create combined product string (like bot does for multiple items)
    const combinedProducts = productDescriptions.join(' + ');
    const totalQuantity = productQuantities.reduce((sum, q) => sum + q, 0);

    console.log(`📦 Creating single order for: ${combinedProducts}`);
    console.log(`💰 Total amount: ${totalAmount} ლარი`);

    const orderData: OrderData = {
      product: combinedProducts,
      quantity: String(totalQuantity),
      clientName: customerName,
      telephone: telephone,
      address: address,
      total: `${totalAmount} ლარი`
    };

    try {
      // Create ONE order for all products combined
      const orderNumber = await logOrder(orderData, 'chat');
      console.log(`✅ Order created: ${orderNumber}`);

      // Send email notification
      try {
        await sendOrderEmail(orderData, orderNumber);
        console.log(`📧 Email sent for order ${orderNumber}`);
      } catch (emailError: any) {
        console.error(`❌ Failed to send email for order ${orderNumber}:`, emailError.message);
      }

      console.log(`✅ Manual order creation complete`);

      return NextResponse.json({
        success: true,
        orderNumber,
        products: productDescriptions,
        totalQuantity,
        totalAmount: `${totalAmount} ლარი`,
        notes: notes || null
      });

    } catch (error: any) {
      console.error(`❌ Failed to create order:`, error);
      return NextResponse.json(
        {
          error: 'Failed to create order',
          details: error.message
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Error creating manual order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create manual order' },
      { status: 500 }
    );
  }
}

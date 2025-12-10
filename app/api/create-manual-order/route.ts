import { NextResponse } from 'next/server';
import { logOrder } from '@/lib/orderLoggerWithFirestore';
import { OrderData, sendOrderEmail } from '@/lib/sendOrderEmail';
import { db } from '@/lib/firestore';
import { updateProductStock } from '@/lib/firestoreSync';

interface FirestoreProduct {
  name: string;
  price: number;
  stock_qty: number;
  type?: string;
}

// Load products from Firestore to get prices and stock
async function loadProducts(): Promise<FirestoreProduct[]> {
  try {
    const snapshot = await db.collection('products').get();
    return snapshot.docs.map(doc => ({
      name: doc.id, // Document ID is the product name
      price: doc.data().price || 0,
      stock_qty: doc.data().stock_qty || 0,
      type: doc.data().type
    }));
  } catch (err) {
    console.error('❌ Error loading products from Firestore:', err);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { products, customerName, telephone, address, city, notes, deliveryType, deliveryCompany } = body;

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

    // Load product catalog from Firestore to get prices and stock
    const productCatalog = await loadProducts();
    console.log(`📦 Loaded ${productCatalog.length} products from Firestore`);

    // Build combined order data
    let totalAmount = 0;
    const productNames: string[] = [];
    let totalQuantity = 0;
    const stockWarnings: string[] = [];
    const matchedProducts: { docId: string; quantity: number }[] = []; // Track for stock updates

    // Calculate total and check stock for each product
    for (const product of products) {
      const quantity = product.quantity || 1;
      const inputName = product.name.toLowerCase().trim();

      // Find product in catalog - flexible matching for Georgian names
      const catalogProduct = productCatalog.find(p => {
        const catalogName = p.name.toLowerCase().trim();
        // Exact match
        if (catalogName === inputName) return true;
        // Catalog name contains input
        if (catalogName.includes(inputName)) return true;
        // Input contains catalog name (for partial matches)
        if (inputName.includes(catalogName) && catalogName.length > 10) return true;
        // Word-based matching
        const inputWords = inputName.split(/\s+/).filter(w => w.length > 2);
        const catalogWords = catalogName.split(/\s+/);
        const matchCount = inputWords.filter(iw =>
          catalogWords.some(cw => cw.includes(iw) || iw.includes(cw))
        ).length;
        return matchCount >= Math.min(3, inputWords.length);
      });

      if (catalogProduct) {
        const price = catalogProduct.price || 0;
        totalAmount += price * quantity;
        console.log(`💰 ${product.name}: ${price} x ${quantity} = ${price * quantity} ლარი`);

        // Track matched product for stock update
        matchedProducts.push({ docId: catalogProduct.name, quantity });

        // Check stock
        if (catalogProduct.stock_qty < quantity) {
          stockWarnings.push(`${product.name}: მარაგშია ${catalogProduct.stock_qty}, მოთხოვნილია ${quantity}`);
          console.warn(`⚠️ Low stock for ${product.name}: have ${catalogProduct.stock_qty}, need ${quantity}`);
        }
      } else {
        console.warn(`⚠️ Product not found in catalog: ${product.name}`);
        // Still add to order but with 0 price - admin can manually adjust
      }

      // Add product name (quantity will be shown separately in total)
      productNames.push(product.name);
      totalQuantity += quantity;
    }

    // Create product string - just names joined, total quantity separate
    const combinedProducts = products.length === 1
      ? productNames[0]
      : productNames.join(' + ');

    console.log(`📦 Creating single order for: ${combinedProducts}`);
    console.log(`💰 Total amount: ${totalAmount} ლარი`);
    console.log(`📍 City: ${city || 'თბილისი'}`);
    console.log(`🚚 Delivery: ${deliveryType || 'standard'} via ${deliveryCompany || 'trackings.ge'}`);

    const orderData: OrderData = {
      product: combinedProducts,
      quantity: String(totalQuantity),
      clientName: customerName,
      telephone: telephone,
      address: address,
      city: city || 'თბილისი',  // Separate city field for shipping
      total: `${totalAmount} ლარი`,
      deliveryType: deliveryType || 'standard',
      deliveryCompany: deliveryCompany || (deliveryType === 'express' ? 'wolt' : 'trackings.ge'),
      notes: notes || undefined
    };

    try {
      // Create ONE order for all products combined
      // Pass skipStockUpdate option since we'll handle stock manually for each product
      const orderNumber = await logOrder(orderData, 'chat', { skipStockUpdate: true });
      console.log(`✅ Order created: ${orderNumber}`);

      // Update stock for each matched product
      console.log(`📦 Updating stock for ${matchedProducts.length} products...`);
      for (const { docId, quantity } of matchedProducts) {
        try {
          const updated = await updateProductStock(docId, quantity, orderNumber);
          if (updated) {
            console.log(`✅ Stock updated for ${docId}: -${quantity}`);
          } else {
            console.warn(`⚠️ Failed to update stock for ${docId}`);
          }
        } catch (stockError: any) {
          console.error(`❌ Error updating stock for ${docId}:`, stockError.message);
        }
      }

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
        products: productNames,
        totalQuantity,
        totalAmount: `${totalAmount} ლარი`,
        notes: notes || null,
        stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined
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

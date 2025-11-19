import { Firestore } from '@google-cloud/firestore';

// Initialize Firestore client
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'bebias-wp-db-handler',
});

export interface ProductStockUpdate {
  sku: string;
  quantity: number;
  orderNumber?: string;
}

/**
 * Update product stock in Firestore after a confirmed sale
 * This will trigger the firestore-trigger Cloud Function to sync back to WooCommerce
 */
export async function updateProductStock(
  sku: string,
  quantityToDeduct: number,
  orderNumber?: string
): Promise<boolean> {
  try {
    const productRef = firestore.collection('products').doc(sku);
    
    // Get current stock
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      console.error(`❌ Product ${sku} not found in Firestore`);
      return false;
    }
    
    const currentStock = productDoc.data()?.stock_qty || 0;
    const newStock = Math.max(0, currentStock - quantityToDeduct);
    
    // Update stock with chatbot as the source
    await productRef.update({
      stock_qty: newStock,
      last_updated_by: 'chatbot',
      last_order_number: orderNumber || null,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`✅ Updated ${sku}: ${currentStock} → ${newStock} (Order: ${orderNumber || 'N/A'})`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating stock for ${sku}:`, error);
    return false;
  }
}

/**
 * Update stock for multiple products (for orders with multiple items)
 */
export async function updateMultipleProductsStock(
  updates: ProductStockUpdate[],
  orderNumber?: string
): Promise<{ success: boolean; updated: string[]; failed: string[] }> {
  const updated: string[] = [];
  const failed: string[] = [];
  
  for (const update of updates) {
    const success = await updateProductStock(
      update.sku,
      update.quantity,
      orderNumber
    );
    
    if (success) {
      updated.push(update.sku);
    } else {
      failed.push(update.sku);
    }
  }
  
  return {
    success: failed.length === 0,
    updated,
    failed,
  };
}

/**
 * Get current stock for a product from Firestore
 */
export async function getProductStock(sku: string): Promise<number | null> {
  try {
    const productRef = firestore.collection('products').doc(sku);
    const productDoc = await productRef.get();
    
    if (!productDoc.exists) {
      console.error(`❌ Product ${sku} not found in Firestore`);
      return null;
    }
    
    return productDoc.data()?.stock_qty || 0;
  } catch (error) {
    console.error(`❌ Error getting stock for ${sku}:`, error);
    return null;
  }
}

/**
 * Check if product has sufficient stock
 */
export async function checkProductAvailability(
  sku: string,
  requestedQuantity: number = 1
): Promise<{ available: boolean; currentStock: number }> {
  const currentStock = await getProductStock(sku);
  
  if (currentStock === null) {
    return { available: false, currentStock: 0 };
  }
  
  return {
    available: currentStock >= requestedQuantity,
    currentStock,
  };
}

/**
 * Reserve stock for a pending order (optional - for bank transfer flow)
 * This creates a temporary hold on stock until payment is confirmed
 */
export async function reserveStock(
  sku: string,
  quantity: number,
  orderNumber: string,
  expiresInMinutes: number = 30
): Promise<boolean> {
  try {
    const reservationRef = firestore
      .collection('stock_reservations')
      .doc(`${orderNumber}_${sku}`);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
    
    await reservationRef.set({
      sku,
      quantity,
      orderNumber,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    
    console.log(`✅ Reserved ${quantity}x ${sku} for order ${orderNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Error reserving stock:`, error);
    return false;
  }
}

/**
 * Confirm reservation and deduct stock (called after bank transfer confirmation)
 */
export async function confirmReservation(
  orderNumber: string,
  sku: string
): Promise<boolean> {
  try {
    const reservationRef = firestore
      .collection('stock_reservations')
      .doc(`${orderNumber}_${sku}`);
    
    const reservationDoc = await reservationRef.get();
    
    if (!reservationDoc.exists) {
      console.error(`❌ Reservation not found: ${orderNumber}_${sku}`);
      return false;
    }
    
    const reservation = reservationDoc.data();
    
    if (reservation?.status !== 'pending') {
      console.error(`❌ Reservation already ${reservation?.status}`);
      return false;
    }
    
    // Update stock
    const success = await updateProductStock(
      sku,
      reservation.quantity,
      orderNumber
    );
    
    if (success) {
      // Mark reservation as confirmed
      await reservationRef.update({
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      });
      
      console.log(`✅ Confirmed reservation for order ${orderNumber}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error confirming reservation:`, error);
    return false;
  }
}

/**
 * Cancel reservation and release stock (if payment fails or expires)
 */
export async function cancelReservation(
  orderNumber: string,
  sku: string
): Promise<boolean> {
  try {
    const reservationRef = firestore
      .collection('stock_reservations')
      .doc(`${orderNumber}_${sku}`);
    
    await reservationRef.update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
    });
    
    console.log(`✅ Cancelled reservation for order ${orderNumber}`);
    return true;
  } catch (error) {
    console.error(`❌ Error cancelling reservation:`, error);
    return false;
  }
}

/**
 * Clean up expired reservations (run periodically)
 */
export async function cleanupExpiredReservations(): Promise<number> {
  try {
    const now = new Date().toISOString();
    const reservationsRef = firestore.collection('stock_reservations');
    
    const expiredSnapshot = await reservationsRef
      .where('status', '==', 'pending')
      .where('expiresAt', '<', now)
      .get();
    
    let count = 0;
    const batch = firestore.batch();
    
    expiredSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'expired',
        expiredAt: now,
      });
      count++;
    });
    
    await batch.commit();
    
    if (count > 0) {
      console.log(`✅ Cleaned up ${count} expired reservations`);
    }
    
    return count;
  } catch (error) {
    console.error(`❌ Error cleaning up reservations:`, error);
    return 0;
  }
}

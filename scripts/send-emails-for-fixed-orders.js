#!/usr/bin/env node

/**
 * Send emails for the fixed orders
 */

const admin = require('firebase-admin');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'bebias-chatbot-key.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

// Setup email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'orders.bebias@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

async function checkAndSendEmails() {
  console.log('📧 Checking fixed orders and sending emails...\n');
  console.log('=' .repeat(50));

  // The order numbers that were fixed
  const fixedOrderNumbers = ['800009', '800007'];

  for (const orderNumber of fixedOrderNumbers) {
    try {
      // Find the order in Firestore
      const ordersRef = db.collection('orders');
      const snapshot = await ordersRef
        .where('orderNumber', '==', orderNumber)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(`❌ Order ${orderNumber} not found in Firestore`);
        continue;
      }

      const orderDoc = snapshot.docs[0];
      const order = orderDoc.data();

      console.log(`\n📦 Order ${orderNumber}:`);
      console.log(`   Customer: ${order.clientName}`);
      console.log(`   Phone: ${order.telephone}`);
      console.log(`   Address: ${order.address}`);
      console.log(`   Products: ${order.product}`);
      console.log(`   Total: ${order.total}`);
      console.log(`   Status: ${order.status || 'pending'}`);
      console.log(`   Source: ${order.source}`);
      console.log(`   Timestamp: ${order.timestamp}`);

      // Check if it has the fixed note
      if (order.notes && order.notes.includes('Fixed: Combined from split orders')) {
        console.log(`   ✅ This order was fixed from split orders`);
      }

      // Send email
      console.log(`\n📧 Sending email for order ${orderNumber}...`);

      const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">📦 შეკვეთა #${orderNumber} (შესწორებული)</h2>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #666;">მიმღების ინფორმაცია:</h3>
          <p><strong>👤 სახელი:</strong> ${order.clientName}</p>
          <p><strong>📞 ტელეფონი:</strong> ${order.telephone}</p>
          <p><strong>📍 მისამართი:</strong> ${order.address}</p>
        </div>

        <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #666;">შეკვეთის დეტალები:</h3>
          <p><strong>📦 პროდუქტი:</strong> ${order.product}</p>
          <p><strong>🔢 რაოდენობა:</strong> ${order.quantity}</p>
          <p><strong>💰 ჯამი:</strong> ${order.total}</p>
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>⚠️ შენიშვნა:</strong> ეს შეკვეთა შესწორდა - გაერთიანდა რამდენიმე ცალკე შეკვეთისგან.</p>
          ${order.notes ? `<p><small>${order.notes}</small></p>` : ''}
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>შეკვეთის თარიღი: ${new Date(order.timestamp).toLocaleString('ka-GE')}</p>
          <p>წყარო: ${order.source === 'chat' ? 'Control Panel (Manual)' : order.source}</p>
        </div>
      </div>
      `;

      const mailOptions = {
        from: `"BEBIAS Orders" <${process.env.EMAIL_USER || 'orders.bebias@gmail.com'}>`,
        to: 'orders.bebias@gmail.com',
        subject: `📦 შეკვეთა #${orderNumber} - ${order.clientName} (შესწორებული)`,
        html: emailContent
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`   ✅ Email sent successfully!`);
      } catch (emailError) {
        console.error(`   ❌ Failed to send email: ${emailError.message}`);
      }

    } catch (error) {
      console.error(`❌ Error processing order ${orderNumber}:`, error.message);
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ Email sending complete!\n');

  // Also check how orders appear in shipping manager
  console.log('📊 Checking Shipping Manager View:\n');

  try {
    // Get all recent orders for shipping view
    const recentOrders = await db.collection('orders')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    console.log('Recent orders in shipping manager format:\n');
    recentOrders.forEach(doc => {
      const order = doc.data();
      if (fixedOrderNumbers.includes(order.orderNumber)) {
        console.log(`📦 Order ${order.orderNumber}:`);
        console.log(`   Display: ${order.clientName} - ${order.product}`);
        console.log(`   Total: ${order.total}`);
        console.log(`   Status: ${order.status || 'pending'}`);
        console.log('   ---');
      }
    });

  } catch (error) {
    console.error('Error checking shipping manager view:', error);
  }
}

// Run
checkAndSendEmails().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(console.error);
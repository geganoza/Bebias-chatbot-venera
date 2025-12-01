#!/usr/bin/env node

/**
 * Resend emails for fixed orders using the existing email system
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.prod') });

// Import the existing email function
const { sendOrderEmail } = require('../lib/sendOrderEmail');

async function resendEmails() {
  console.log('📧 Sending emails for fixed orders...\n');
  console.log('=' .repeat(50));

  // The fixed orders data
  const fixedOrders = [
    {
      orderNumber: '800009',
      orderData: {
        product: 'რუხი ქუდი მთლიანი სარჩულით - სტანდარტი (M) + შავი ბამბის მოკლე ქუდი M',
        quantity: '2',
        clientName: 'უჩა მეგრელიშვილი',
        telephone: '593737357',
        address: 'გლდანის 4 მიკრო 105 კორპუსი 8 სადარბაზო',
        total: '118 ლარი'
      }
    },
    {
      orderNumber: '800007',
      orderData: {
        product: 'ნაცრისფერი ქუდი პომპონით - L + ყვითელი ქუდი პომპონით - XS',
        quantity: '2',
        clientName: 'ზაზა ქარქაშაძე',
        telephone: '577227048',
        address: 'ანა პოლიტკოვსკაიას 12 ა',
        total: '118 ლარი'
      }
    }
  ];

  for (const order of fixedOrders) {
    console.log(`\n📦 Sending email for order ${order.orderNumber}...`);
    console.log(`   Customer: ${order.orderData.clientName}`);
    console.log(`   Products: ${order.orderData.product}`);
    console.log(`   Total: ${order.orderData.total}`);

    try {
      await sendOrderEmail(order.orderData, order.orderNumber);
      console.log(`   ✅ Email sent successfully!`);
    } catch (error) {
      console.error(`   ❌ Failed to send email: ${error.message}`);
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✅ Done!\n');
}

// Run
resendEmails().then(() => {
  process.exit(0);
}).catch(console.error);
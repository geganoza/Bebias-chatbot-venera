import { createTransport } from 'nodemailer';

export interface OrderData {
  product: string;
  quantity: string;
  clientName: string;
  telephone: string;
  address: string;
  total: string;
}

export async function sendOrderEmail(orderData: OrderData, orderNumber?: string): Promise<boolean> {
  try {
    // Create transporter using Gmail SMTP
    // You'll need to set up App Password in Gmail for this to work
    const transporter = createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password',
      },
    });

    const subject = orderNumber
      ? `🛍️ ახალი შეკვეთა #${orderNumber}: ${orderData.product}`
      : `🛍️ ახალი შეკვეთა: ${orderData.product}`;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@bebias.ge',
      to: 'orders.bebias@gmail.com',
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">ახალი შეკვეთა მიღებულია</h2>
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2d3748;">შეკვეთის დეტალები:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${orderNumber ? `
              <tr>
                <td style="padding: 8px 0; color: #4a5568; font-weight: bold;">შეკვეთის ნომერი:</td>
                <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #2b6cb0;">#${orderNumber}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #4a5568; font-weight: bold;">პროდუქტი:</td>
                <td style="padding: 8px 0;">${orderData.product}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4a5568; font-weight: bold;">რაოდენობა:</td>
                <td style="padding: 8px 0;">${orderData.quantity}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4a5568; font-weight: bold;">კლიენტის სახელი:</td>
                <td style="padding: 8px 0;">${orderData.clientName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4a5568; font-weight: bold;">ტელეფონი:</td>
                <td style="padding: 8px 0;"><a href="tel:${orderData.telephone}">${orderData.telephone}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4a5568; font-weight: bold;">მისამართი:</td>
                <td style="padding: 8px 0;">${orderData.address}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4a5568; font-weight: bold;">ჯამი:</td>
                <td style="padding: 8px 0; font-size: 18px; color: #2b6cb0; font-weight: bold;">${orderData.total}</td>
              </tr>
            </table>
          </div>
          <p style="color: #718096; font-size: 14px;">
            ეს შეკვეთა გაგზავნილია VENERA ჩატბოტიდან.
          </p>
        </div>
      `,
      text: `
ახალი შეკვეთა მიღებულია
${orderNumber ? `\nშეკვეთის ნომერი: #${orderNumber}` : ''}

პროდუქტი: ${orderData.product}
რაოდენობა: ${orderData.quantity}
კლიენტის სახელი: ${orderData.clientName}
ტელეფონი: ${orderData.telephone}
მისამართი: ${orderData.address}
ჯამი: ${orderData.total}

ეს შეკვეთა გაგზავნილია VENERA ჩატბოტიდან.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Order email sent successfully to orders.bebias@gmail.com');
    return true;
  } catch (error) {
    console.error('❌ Error sending order email:', error);
    return false;
  }
}

// Helper function to parse ORDER_NOTIFICATION format from bot response
export function parseOrderNotification(text: string): OrderData | null {
  console.log(`🔍 parseOrderNotification called, text length: ${text.length}`);

  // Check if ORDER_NOTIFICATION marker exists
  if (!text.includes('ORDER_NOTIFICATION')) {
    console.log('❌ No ORDER_NOTIFICATION marker found');
    return null;
  }

  // Extract the block after ORDER_NOTIFICATION
  const notifIndex = text.indexOf('ORDER_NOTIFICATION');
  const orderBlock = text.substring(notifIndex);
  console.log(`🔍 ORDER_NOTIFICATION block (first 400 chars): ${orderBlock.substring(0, 400)}`);

  // FLEXIBLE FIELD EXTRACTION - handles both English and Georgian field names
  // Extract each field independently to handle mixed formats

  // Product: English or Georgian
  const productMatch = orderBlock.match(/(?:Product|პროდუქტი):\s*(.+?)(?:\n|$)/i);

  // Client Name: various formats
  const clientNameMatch = orderBlock.match(/(?:Client Name|კლიენტის სახელი|გაყიდვის სახელი|სახელი|Name):\s*(.+?)(?:\n|$)/i);

  // Telephone: English or Georgian
  const telephoneMatch = orderBlock.match(/(?:Telephone|Phone|ტელეფონი):\s*(.+?)(?:\n|$)/i);

  // Address: English or Georgian
  const addressMatch = orderBlock.match(/(?:Address|მისამართი):\s*(.+?)(?:\n|$)/i);

  // Total: English or Georgian (capture up to newline or ლარი or end)
  const totalMatch = orderBlock.match(/(?:Total|ჯამი|თანხა):\s*(.+?)(?:\n|$)/i);

  console.log(`🔍 Field extraction results:`);
  console.log(`   Product: ${productMatch ? 'FOUND' : 'MISSING'}`);
  console.log(`   Client Name: ${clientNameMatch ? 'FOUND' : 'MISSING'}`);
  console.log(`   Telephone: ${telephoneMatch ? 'FOUND' : 'MISSING'}`);
  console.log(`   Address: ${addressMatch ? 'FOUND' : 'MISSING'}`);
  console.log(`   Total: ${totalMatch ? 'FOUND' : 'MISSING'}`);

  // All fields are required
  if (productMatch && clientNameMatch && telephoneMatch && addressMatch && totalMatch) {
    const result = {
      product: productMatch[1].trim(),
      quantity: '1',
      clientName: clientNameMatch[1].trim(),
      telephone: telephoneMatch[1].trim().replace(/\s/g, ''),
      address: addressMatch[1].trim(),
      total: totalMatch[1].trim(),
    };
    console.log('✅ Parsed ORDER_NOTIFICATION successfully (flexible extraction)');
    console.log(`📦 Order: ${result.product}, ${result.clientName}, ${result.telephone}`);
    return result;
  }

  // Fallback: try to parse comma-separated format that AI sometimes uses
  const fallbackMatch = text.match(/ORDER_NOTIFICATION:\s*([^,]+),\s*(\d+)\s*ლარი?,\s*([^,]+),\s*([\d+\s]+),\s*(.+?)(?:\n|$)/);
  if (fallbackMatch) {
    console.log('⚠️ Parsed ORDER_NOTIFICATION in fallback comma format');
    return {
      product: fallbackMatch[1].trim(),
      quantity: '1',
      clientName: fallbackMatch[3].trim(),
      telephone: fallbackMatch[4].trim().replace(/\s/g, ''),
      address: fallbackMatch[5].trim(),
      total: fallbackMatch[2].trim() + ' ლარი',
    };
  }

  console.log('❌ Could not parse ORDER_NOTIFICATION - missing required fields');
  return null;
}

import { createTransport } from 'nodemailer';

export interface OrderData {
  product: string;
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
  const match = text.match(/ORDER_NOTIFICATION:[\s\S]*?Product:\s*(.+?)\s*Client Name:\s*(.+?)\s*Telephone:\s*(.+?)\s*Address:\s*(.+?)\s*Total:\s*(.+?)(?:\s|$)/);

  if (match) {
    return {
      product: match[1].trim(),
      clientName: match[2].trim(),
      telephone: match[3].trim(),
      address: match[4].trim(),
      total: match[5].trim(),
    };
  }

  return null;
}

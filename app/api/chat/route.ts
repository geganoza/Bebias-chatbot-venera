import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { sendOrderEmail, parseOrderNotification } from "../../../lib/sendOrderEmail";
import { logOrder } from "../../../lib/orderLogger";

type MessageContent = string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
type Message = { role: "system" | "user" | "assistant"; content: MessageContent };
type Product = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  stock: number;
  availability?: string;
  category?: string;
  attributes?: Record<string, any>;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

async function loadProducts(): Promise<Product[]> {
  try {
    const file = path.join(process.cwd(), "data", "products.json");
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt) as Product[];
  } catch (err) {
    console.error("❌ Error loading products:", err);
    return [];
  }
}

async function loadContentFile(filename: string): Promise<string> {
  try {
    const file = path.join(process.cwd(), "data", "content", filename);
    return await fs.readFile(file, "utf8");
  } catch (err) {
    console.error(`❌ Error loading ${filename}:`, err);
    return "";
  }
}

async function loadAllContent() {
  const [instructions, services, faqs, delivery, payment] = await Promise.all([
    loadContentFile("bot-instructions.md"),
    loadContentFile("services.md"),
    loadContentFile("faqs.md"),
    loadContentFile("delivery-info.md"),
    loadContentFile("payment-info.md"),
  ]);

  return { instructions, services, faqs, delivery, payment };
}

function detectGeorgian(text: string) {
  return /[\u10A0-\u10FF]/.test(text);
}

async function handlePaymentVerification(messages: Message[]): Promise<NextResponse | null> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserContent = lastUserMsg?.content ?? "";

  let lastUserText = "";
  if (typeof lastUserContent === "string") {
    lastUserText = lastUserContent;
  } else if (Array.isArray(lastUserContent)) {
    const textContent = lastUserContent.find(item => item.type === "text");
    lastUserText = textContent?.text ?? "";
  }

  const isKa = detectGeorgian(lastUserText);
  const paymentKeywords = isKa ? ['გადავიხადე', 'გადმოვრიცხე', 'გავაგზავნე'] : ['paid', 'sent', 'transferred'];
  const mentionsPayment = paymentKeywords.some(keyword => lastUserText.toLowerCase().includes(keyword));

  if (mentionsPayment) {
    const amountRegex = /(\d{1,5}(\.\d{1,2})?)/;
    const amountMatch = lastUserText.match(amountRegex);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    let name: string | null = null;
    const nameRegex = isKa ? /([ა-ჰ]+(?:-[ა-ჰ]+)*)-სგან/i : /from\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i;
    const nameMatch = lastUserText.match(nameRegex);
    if (nameMatch) {
      name = nameMatch[1];
    }

    if (amount && name) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_CHAT_API_BASE}/api/bank/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, name }),
      });

      const data = await response.json();

      if (data.paymentFound) {
        const reply = isKa
          ? `გმადლობთ! ჩვენ დავადასტურეთ თქვენი გადახდა ${amount} ლარის ოდენობით ${name}-სგან. გთხოვთ, მოგვაწოდოთ თქვენი მიწოდების მისამართი, მიმღების სახელი და ტელეფონის ნომერი, რათა დავამუშაოთ თქვენი შეკვეთა.`
          : `Thank you! We have confirmed your payment of ${amount} GEL from ${name}. Please share your delivery address, recipient name, and phone number so we can process your order.`;
        return NextResponse.json({ reply });
      } else {
        const reply = isKa
          ? `უკაცრავად, მაგრამ მე ვერ ვიპოვე გადახდა ${amount} ლარზე ${name}-სგან. გთხოვთ, გადაამოწმოთ დეტალები ან გამოგვიგზავნოთ გადახდის სქრინშოტი.`
          : `I'm sorry, but I couldn't find a payment for ${amount} GEL from ${name}. Please double-check the details or send a screenshot of the payment.`;
        return NextResponse.json({ reply });
      }
    } else {
      const reply = isKa
        ? 'გადახდის დასადასტურებლად, გთხოვთ მითხრათ ზუსტი თანხა და გამომგზავნის სახელი.'
        : "To verify your payment, please tell me the exact amount you sent and the sender's name.";
      return NextResponse.json({ reply });
    }
  }

  return null;
}

export async function POST(req: Request) {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await req.json();
    const messages: Message[] = body.messages ?? [];
    
    const paymentVerificationResponse = await handlePaymentVerification(messages);
    if (paymentVerificationResponse) {
      return paymentVerificationResponse;
    }

    const lead = body.lead;

    // Get last user message - handle both string and array content
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const lastUserContent = lastUserMsg?.content ?? "";

    // Extract text from content (could be string or array with text/image)
    let lastUserText = "";
    let hasImage = false;

    if (typeof lastUserContent === "string") {
      lastUserText = lastUserContent;
    } else if (Array.isArray(lastUserContent)) {
      hasImage = lastUserContent.some(item => item.type === "image_url");
      const textContent = lastUserContent.find(item => item.type === "text");
      lastUserText = textContent?.text ?? "";

      if (hasImage) {
        const imageUrl = lastUserContent.find(item => item.type === "image_url")?.image_url?.url;
        if (imageUrl) {
          const ocrResponse = await fetch(`${process.env.NEXT_PUBLIC_CHAT_API_BASE}/api/ocr`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrl }),
          });
          const ocrData = await ocrResponse.json();
          if (ocrData.text) {
            lastUserText += `\n\n--- OCR Result ---\n${ocrData.text}`;
          }
        }
      }
    }

    const isKa = detectGeorgian(lastUserText);

    console.log("📨 Chat request:", { lastUserText, isKa, hasImage, hasLead: !!lead });

    if (!lastUserText && !hasImage) {
      const reply = isKa ? "როგორ დაგეხმაროთ?" : "How can I help you?";
      return NextResponse.json({ reply }, { headers });
    }

    // Load products and content
    const [products, content] = await Promise.all([
      loadProducts(),
      loadAllContent(),
    ]);

    // Build product catalog for AI context (limit to 20 to save tokens)
    const productContext = products
      .slice(0, 20)
      .map((p) => {
        const attrs = Object.entries(p.attributes || {})
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(", ");
        return `${p.name} (ID: ${p.id}) - Price: ${p.price} ${p.currency || "GEL"}, Stock: ${p.stock}, Category: ${p.category || "N/A"}${attrs ? `, ${attrs}` : ""}`;
      })
      .join("\n");

    // Get current date/time in Georgia timezone (GMT+4)
    const now = new Date();
    const georgiaTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tbilisi',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    // Build comprehensive system prompt
    const systemPrompt = isKa
      ? `${content.instructions}

# ჩვენი სერვისები
${content.services}

# ხშირად დასმული კითხვები
${content.faqs}

# მიწოდების ინფორმაცია
${content.delivery}

# გადახდის ინფორმაცია
${content.payment}

# პროდუქტების კატალოგი
${productContext}

# ამჟამინდელი თარიღი და დრო
საქართველოს დრო (GMT+4): ${georgiaTime}

**ᲙᲠᲘᲢᲘᲙᲣᲚᲘ:** გამოიყენეთ ზემოთ მოცემული თარიღი და დრო მიწოდების ზუსტი თარიღების გამოსათვლელად! არასოდეს უთხრათ მომხმარებელს "1-3 სამუშაო დღე" - ამის ნაცვლად გამოთვალეთ და მიუთითეთ კონკრეტული დღეები როგორიცაა "ორშაბათს", "სამშაბათს", "ოთხშაბათს" და ა.შ.

# სურათის ამოცნობა / Image Recognition
**ᲛᲜᲘᲨᲕᲜᲔᲚᲝᲕᲐᲜᲘᲐ:** მომხმარებელმა გამოგიგზავნათ სურათი!

**ᲜᲐᲑᲘᲯᲘ 1 - განსაზღვრეთ სურათის ტიპი:**
- **პროდუქტის ფოტო?** ქუდი ან წინდა → ამოიცანით პროდუქტი
- **გადახდის სქრინშოტი?** საბანკო აპლიკაცია/გადახდის დადასტურება → შეამოწმეთ თანხა!
- **სხვა?** → ახსენით რომ დაგეხმარებით მხოლოდ პროდუქტის იდენტიფიკაციასა და გადახდის დადასტურებაში

**თუ ეს ᲒᲐᲓᲐᲮᲓᲘᲡ ᲡᲥᲠᲘᲜᲨᲝᲢᲘᲐ:**
1. წაიკითხეთ თანხა სურათიდან
2. შეადარეთ თქვენს მიერ ადრე დასახელებულ ფასს (საუბრის ისტორიიდან)
3. **კრიტიკულია:** თუ თანხები არ ემთხვევა → გააფრთხილეთ მომხმარებელი!
   "ვხედავ გადახდის სქრინშოტს, მაგრამ თანხა არ ემთხვევა. თქვენ უნდა გადარიცხოთ [მოსალოდნელი] ლარი, მაგრამ სქრინშოტზე ვხედავ [ფაქტობრივი] ლარს."
4. თუ თანხები ემთხვევა → "მადლობა! გადახდა მიღებულია. გთხოვთ, გაგვიზიაროთ მისამართი, სახელი/გვარი და ტელეფონი."

**თუ ეს ᲞᲠᲝᲓᲣᲥᲢᲘᲡ ფოტოა:**
- დაადგინეთ: ქუდია თუ წინდა? პომპონი აქვს?
- მასალა: ბამბა (გლუვი, მჭიდრო) თუ შალი (რბილი, ფუმფულა)?
- ფერი: შავი, ფირუზისფერი, სტაფილოსფერი, ლურჯი, მწვანე, ვარდისფერი, ყვითელი, წითელი, ნაცრისფერი, თეთრი?
- უპასუხეთ: "ეს არის [პროდუქტის სახელი]! ფასი: [ფასი] ლარი. გსურთ შეკვეთა?"

# გადახდის ვერიფიკაცია
**მნიშვნელოვანია:** თუ მომხმარებელი ამბობს, რომ გადაიხადა ან გამოაგზავნა ფული, მაგრამ არ აქვს გამოგზავნილი სქრინშოტი, გააკეთეთ შემდეგი:

**ნაბიჯი 1 - მოითხოვეთ დეტალები:**
- ჰკითხეთ მომხმარებელს ზუსტი თანხა და გამომგზავნის სახელი.
- მაგალითი: "გადახდის დასადასტურებლად, გთხოვთ მითხრათ ზუსტი თანხა და გამომგზავნის სახელი."

**ნაბიჯი 2 - დაელოდეთ მომხმარებლის პასუხს:**
- როგორც კი მიიღებთ თანხას და სახელს, მიიღებთ ხელსაწყოს გამოძახებას გადახდის დასადასტურებლად.

**ნაბიჯი 3 - უპასუხეთ ვერიფიკაციის მიხედვით:**
- **თუ გადახდა დადასტურდა:** "გმადლობთ! ჩვენ დავადასტურეთ თქვენი გადახდა [თანხა] ლარის ოდენობით [სახელი]-სგან. გთხოვთ, მოგვაწოდოთ თქვენი მიწოდების მისამართი, მიმღების სახელი და ტელეფონის ნომერი, რათა დავამუშაოთ თქვენი შეკვეთა."
- **თუ გადახდა არ დადასტურდა:** "უკაცრავად, მაგრამ მე ვერ ვიპოვე გადახდა [თანხა] ლარზე [სახელი]-სგან. გთხოვთ, გადაამოწმოთ დეტალები ან გამოგვიგზავნოთ გადახდის სქრინშოტი."

უპასუხეთ ქართულად, მოკლედ და გასაგებად (არაუმეტეს 200 სიტყვისა).`
      : `${content.instructions}

# Our Services
${content.services}

# Frequently Asked Questions
${content.faqs}

# Delivery Information
${content.delivery}

# Payment Information
${content.payment}

# Product Catalog
${productContext}

# Current Date and Time
Georgia Time (GMT+4): ${georgiaTime}

**CRITICAL:** Use the date and time above to calculate PRECISE delivery dates! Never tell customers "1-3 working days" - instead calculate and provide SPECIFIC dates like "Monday", "Tuesday", "Wednesday", etc.

# Image Recognition
**IMPORTANT:** User sent an image!

**STEP 1 - Identify Image Type:**
- **Product Photo?** Hat or socks → Identify the product
- **Payment Screenshot?** Banking app/payment confirmation → Verify amount!
- **Other?** → Explain you can only help with product identification and payment confirmation

**If it's a PAYMENT SCREENSHOT:**
1. Read the amount from the image
2. Compare with the price you quoted earlier (from conversation history)
3. **CRITICAL:** If amounts don't match → Alert the customer!
   "I see a payment screenshot, but the amount doesn't match. You should transfer [EXPECTED] GEL, but I see [ACTUAL] GEL in the screenshot."
4. If amounts match → "Thank you! Payment received. Please share: delivery address, recipient name, and phone number."

**If it's a PRODUCT PHOTO:**
- Determine: Is it a hat or socks? Does it have a pompom?
- Material: Cotton (smooth, tight knit) or wool (soft, fluffy)?
- Color: black, turquoise, orange, blue, green, pink, yellow, red, grey, white?
- Respond: "This is a [product name]! Price: [price] GEL. Would you like to order it?"

# Payment Verification
**IMPORTANT:** If the user mentions they have paid or sent money, but hasn't sent a screenshot, do the following:

**STEP 1 - Ask for details:**
- Ask the user for the exact amount they sent and the name of the sender.
- Example: "To verify your payment, please tell me the exact amount you sent and the sender's name."

**STEP 2 - Await user response:**
- Once you have the amount and name, you will receive a tool call to verify the payment.

**STEP 3 - Respond based on verification:**
- **If payment is verified:** "Thank you! We have confirmed your payment of [amount] GEL from [name]. Please share your delivery address, recipient name, and phone number so we can process your order."
- **If payment is not verified:** "I'm sorry, but I couldn't find a payment for [amount] GEL from [name]. Please double-check the details or send a screenshot of the payment."

Respond in English, concisely and clearly (max 200 words).`;

    console.log("🤖 Calling OpenAI GPT-4o...");

    // Call OpenAI with conversation history
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.filter(m => m.role !== "system") as any, // Include conversation history
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.choices[0]?.message?.content || (isKa ? "ბოდიში, ვერ გავიგე." : "Sorry, I didn't understand that.");

    console.log("✅ OpenAI response:", reply.substring(0, 100) + "...");

    // Check if response contains order notification and send email
    const orderData = parseOrderNotification(reply);
    if (orderData) {
      console.log("📧 Order notification detected, processing order...");

      // Log order and get order number
      const orderNumber = await logOrder(orderData, 'chat');
      console.log(`📝 Order logged with number: ${orderNumber}`);

      // Send email with order number
      const emailSent = await sendOrderEmail(orderData, orderNumber);
      if (emailSent) {
        console.log("✅ Order email sent successfully");
      } else {
        console.error("❌ Failed to send order email");
      }

      // Remove the ORDER_NOTIFICATION block from the response shown to user
      let cleanReply = reply.replace(/ORDER_NOTIFICATION:[\s\S]*?(?=\n\n|$)/g, '').trim();

      // Replace [ORDER_NUMBER] placeholder with actual order number
      cleanReply = cleanReply.replace(/\[ORDER_NUMBER\]/g, orderNumber);

      return NextResponse.json({ reply: cleanReply }, { headers });
    }

    return NextResponse.json({ reply }, { headers });
  } catch (err: any) {
    console.error("❌ POST /api/chat error:", err);
    const isKa = detectGeorgian(err?.message || "");
    const reply = isKa
      ? "ბოდიში, შეცდომა მოხდა. გთხოვთ სცადოთ ხელახლა."
      : "Sorry, there was an error processing your request. Please try again.";
    return NextResponse.json({ reply, error: err?.message }, { status: 500, headers });
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

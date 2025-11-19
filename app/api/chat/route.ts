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
  name_en?: string;
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
  if (!lastUserMsg) return null;

  const lastUserContent = lastUserMsg.content ?? "";
  let lastUserText = "";
  if (typeof lastUserContent === "string") {
    lastUserText = lastUserContent;
  } else if (Array.isArray(lastUserContent)) {
    const textContent = lastUserContent.find(item => item.type === "text");
    lastUserText = textContent?.text ?? "";
  }

  const isKa = detectGeorgian(lastUserText);

  // Check if bot just provided bank account in previous message
  const lastBotMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const lastBotText = typeof lastBotMsg?.content === 'string' ? lastBotMsg.content : '';
  const botProvidedBankAccount = lastBotText.includes('GE09TB') || lastBotText.includes('GE31BG');

  // Keywords indicating payment was made
  const paymentKeywords = isKa
    ? ['გადავიხადე', 'გადმოვრიცხე', 'გავაგზავნე', 'ჩავრიცხე', 'გადავრიცხე']
    : ['paid', 'sent', 'transferred'];
  const mentionsPayment = paymentKeywords.some(keyword => lastUserText.toLowerCase().includes(keyword));

  // If user just sent name + phone + address after bank account was provided, treat as payment confirmation
  const hasPhoneNumber = /\d{9}/.test(lastUserText); // Georgian phone numbers
  const hasName = /[ა-ჰ]{2,}/.test(lastUserText) || /[a-z]{2,}/i.test(lastUserText);

  const likelyPaymentConfirmation = botProvidedBankAccount && hasPhoneNumber && hasName;

  if (!mentionsPayment && !likelyPaymentConfirmation) {
    return null;
  }

  // Extract expected amount from conversation history
  let expectedAmount: number | null = null;
  for (let i = messages.length - 1; i >= 0 && i >= messages.length - 5; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && typeof msg.content === 'string') {
      // Look for patterns like "55 ლარი" or "ჯამური თანხა იქნება 55"
      const amountMatch = msg.content.match(/(\d{1,5}(\.\d{1,2})?)\s*ლარ/);
      if (amountMatch) {
        expectedAmount = parseFloat(amountMatch[1]);
        break;
      }
    }
  }

  // Extract name from user message (Georgian or Latin)
  let name: string | null = null;
  const georgianNameMatch = lastUserText.match(/([ა-ჰ]+\s+[ა-ჰ]+)/);
  const latinNameMatch = lastUserText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  name = georgianNameMatch?.[1] || latinNameMatch?.[1] || null;

  if (expectedAmount && name) {
    console.log(`🏦 Verifying payment: ${expectedAmount} GEL from "${name}"`);

    const apiBase = process.env.NEXT_PUBLIC_CHAT_API_BASE || 'https://bebias-venera-chatbot.vercel.app';
    console.log(`🔗 Using API base: ${apiBase}`);

    const response = await fetch(`${apiBase}/api/bank/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: expectedAmount, name }),
    });

    if (!response.ok) {
      console.error(`❌ Bank API returned error status: ${response.status}`);
      const reply = isKa
        ? 'ბოდიში, ვერ ვუკავშირდებით გადახდის სისტემას. გთხოვთ, სცადოთ მოგვიანებით.'
        : 'Sorry, unable to connect to payment system. Please try again later.';
      return NextResponse.json({ reply });
    }

    const data = await response.json();

    console.log(`🏦 Payment verification result:`, data);

    if (data.paymentFound) {
      const reply = isKa
        ? `✅ გადახდა დადასტურდა! ${expectedAmount} ლარი მიღებულია "${name}"-ისგან.\n\nგთხოვთ, გაგრძელდეს შეკვეთის დამუშავება მიწოდების დეტალებით.`
        : `✅ Payment confirmed! ${expectedAmount} GEL received from "${name}".\n\nPlease proceed with the order using the delivery details provided.`;

      console.log(`✅ Payment verified - proceeding with order`);
      return NextResponse.json({ reply });
    } else {
      const reply = isKa
        ? `❌ გადახდა ვერ მოიძებნა. ვეძებთ ${expectedAmount} ლარს "${name}"-ისგან.\n\nგთხოვთ დარწმუნდით რომ:\n- გადახდა დასრულებულია\n- სახელი სწორია: ${name}\n- თანხა შეესაბამება: ${expectedAmount} ლარი`
        : `❌ Payment not found. Looking for ${expectedAmount} GEL from "${name}".\n\nPlease make sure:\n- Payment is complete\n- Name matches: ${name}\n- Amount is correct: ${expectedAmount} GEL`;

      console.log(`❌ Payment NOT verified`);
      return NextResponse.json({ reply });
    }
  } else {
    const reply = isKa
      ? 'გადახდის დასადასტურებლად, გთხოვთ მითხრათ ზუსტი თანხა და გამომგზავნის სახელი.'
      : "To verify your payment, please tell me the exact amount you sent and the sender's name.";
    return NextResponse.json({ reply });
  }
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
        const productName = !isKa && p.name_en ? p.name_en : p.name;
        const attrs = Object.entries(p.attributes || {})
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(", ");
        return `${productName} (ID: ${p.id}) - Price: ${p.price} ${p.currency || "GEL"}, Stock: ${p.stock}, Category: ${p.category || "N/A"}${attrs ? `, ${attrs}` : ""}`;
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
- უპასუხეთ მოკლედ: "[პროდუქტის სახელი] - [ფასი] ლარი"

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
- Respond concisely: "[product name] - [price] GEL"

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

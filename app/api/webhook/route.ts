import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

type Message = { role: "system" | "user" | "assistant"; content: string };
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

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || "";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "your_verify_token_123";

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

function detectGeorgian(text: string) {
  return /[\u10A0-\u10FF]/.test(text);
}

async function sendMessage(recipientId: string, messageText: string) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  console.log(`📤 Sending message to ${recipientId}:`, messageText);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Facebook API error:", data);
    } else {
      console.log("✅ Message sent successfully:", data);
    }

    return data;
  } catch (err) {
    console.error("❌ Error sending message:", err);
    throw err;
  }
}

async function getAIResponse(userMessage: string): Promise<string> {
  try {
    const products = await loadProducts();
    const isKa = detectGeorgian(userMessage);

    // Build product catalog for AI context
    const productContext = products
      .slice(0, 50)
      .map((p) => `${p.name} (ID: ${p.id}) - Price: ${p.price} ${p.currency || ""}, Stock: ${p.stock}, Category: ${p.category || "N/A"}`)
      .join("\n");

    const systemPrompt = isKa
      ? `თქვენ ხართ Martivi Consulting-ის მეგობრული ასისტენტი. დაეხმარეთ მომხმარებლებს პროდუქტების პოვნაში.\n\nპროდუქტები:\n${productContext}\n\nუპასუხეთ მარტივად და მოკლედ (1-2 წინადადება), თბილად და მეგობრულად.\n\nმნიშვნელოვანი:\n- გამოიყენეთ "ბოდიში" (არა "ბოდიშით")\n- არასოდეს გამოიყენოთ სიტყვა "ბინი", ქართულად beanie არის "ქუდი"\n- იყავით მოკლე, მარტივი და თბილი\n- გამოიყენეთ "თქვენ/გაინტერესებთ" (არა "შენ")\n- იყავით მეგობრული, მაგრამ თავაზიანი`
      : `You are a friendly assistant for Martivi Consulting. Help users find products.\n\nProducts:\n${productContext}\n\nRespond briefly (1-2 sentences max) using plain, casual but polite language.\n\nImportant:\n- Be concise and warm\n- Avoid overly formal/official language\n- Keep it simple and natural`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || (isKa ? "ბოდიში, ვერ გავიგე." : "Sorry, I didn't understand that.");
  } catch (err) {
    console.error("❌ OpenAI API error:", err);
    return "Sorry, there was an error processing your request.";
  }
}

// GET handler for webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("🔍 Webhook verification request:");
  console.log("  Mode:", mode);
  console.log("  Token received:", token);
  console.log("  Token expected:", VERIFY_TOKEN);
  console.log("  Tokens match:", token === VERIFY_TOKEN);
  console.log("  Challenge:", challenge);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("❌ Webhook verification failed");
  console.error(`  Expected: '${VERIFY_TOKEN}', Received: '${token}'`);
  return new NextResponse("Forbidden", { status: 403 });
}

// POST handler for incoming messages
export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("📩 Incoming Messenger webhook:");
    console.log(JSON.stringify(body, null, 2));

    // Check if this is a page event
    if (body.object === "page") {
      // Iterate over entries
      for (const entry of body.entry || []) {
        console.log(`📦 Processing entry ID: ${entry.id}`);

        // Iterate over messaging events
        for (const event of entry.messaging || []) {
          console.log(`💬 Processing messaging event:`, JSON.stringify(event, null, 2));

          const senderId = event.sender?.id;
          const messageText = event.message?.text;
          const hasAttachments = event.message?.attachments && event.message.attachments.length > 0;

          if (senderId) {
            // Handle attachments - we don't have permission to view them yet
            if (hasAttachments) {
              console.log(`👤 User ${senderId} sent attachment(s)`);
              const isKa = messageText ? detectGeorgian(messageText) : true; // Default to Georgian

              const attachmentResponse = isKa
                ? "სურათი არ გაიხსნა 😔 რა ფერის ქუდი გაინტერესებთ? გამოგიგზავნით ფოტოებს."
                : "The picture didn't open 😔 What color beanie are you looking for? I'll send you some photos.";

              await sendMessage(senderId, attachmentResponse);
            }
            // Handle text messages
            else if (messageText) {
              console.log(`👤 User ${senderId} said: "${messageText}"`);

              // Call the full chat API which has payment verification logic
              try {
                const chatResponse = await fetch(`${process.env.NEXT_PUBLIC_CHAT_API_BASE || 'https://bebias-venera-chatbot.vercel.app'}/api/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    messages: [{ role: 'user', content: messageText }],
                  }),
                });

                const chatData = await chatResponse.json();
                const response = chatData.reply || 'ბოდიში, დაფიქსირდა შეცდომა.';

                // Send response back to user
                await sendMessage(senderId, response);
              } catch (error) {
                console.error('❌ Error calling chat API:', error);
                // Fallback to simple AI response
                const response = await getAIResponse(messageText);
                await sendMessage(senderId, response);
              }
            } else {
              console.log("⚠️ Event does not contain sender ID or message text");
            }
          }
        }
      }

      // Return 200 OK to acknowledge receipt
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    console.log("⚠️ Unknown webhook event");
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  } catch (err: any) {
    console.error("❌ POST /api/webhook error:", err);
    return NextResponse.json(
      { error: err?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}

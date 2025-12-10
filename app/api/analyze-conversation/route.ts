import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '@/lib/firestore';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// Load products from Firestore for AI context
async function loadProducts(): Promise<any[]> {
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
    const { conversation } = await req.json();

    if (!conversation || typeof conversation !== 'string') {
      return NextResponse.json(
        { error: 'Conversation text is required' },
        { status: 400 }
      );
    }

    console.log('🤖 Analyzing conversation for order extraction...');

    // Load products for context
    const products = await loadProducts();
    console.log(`📦 Loaded ${products.length} products from Firestore for AI context`);

    // Filter to only show sellable products (variations with price > 0, or simple products)
    const sellableProducts = products.filter(p =>
      p.price > 0 && p.type !== 'variable'
    );

    const productContext = sellableProducts
      .map((p) => `${p.name} - ${p.price} ლარი (მარაგში: ${p.stock_qty})`)
      .join('\n');

    // AI prompt to extract order details
    const systemPrompt = `You are an AI assistant that extracts order information from customer conversations in Georgian language.

# Available Products (from catalog):
${productContext}

# Your Task:
Analyze the conversation and extract ALL order details. Return a JSON object with this EXACT structure:

{
  "products": [
    {
      "name": "product name EXACTLY as shown in catalog above",
      "quantity": number
    }
  ],
  "customerName": "customer's full name",
  "telephone": "phone number",
  "address": "full delivery address",
  "notes": "any additional notes or special requests (NOT delivery method)",
  "deliveryType": "express" or "standard",
  "deliveryCompany": "wolt" or "trackings.ge"
}

# Delivery Type Detection:
- If customer mentions "ვოლტი", "wolt", "ექსპრესი", "express", "იმავე დღეს", "სწრაფი მიწოდება", "დღესვე" → deliveryType: "express", deliveryCompany: "wolt"
- If customer mentions "სტანდარტული", "trackings", "1-3 დღე", or doesn't specify → deliveryType: "standard", deliveryCompany: "trackings.ge"
- Default to "standard" and "trackings.ge" if no delivery preference mentioned

# Important Rules:
1. IMPORTANT: Match product names EXACTLY to the catalog above. Use the full product name from the catalog.
2. When customer uses informal names like colors only (მწვანე, შავი, ყავისფერი, წითელი), match to the correct product in catalog:
   - "მწვანე" or "მწვანეს" = look for "მწვანე" in product names (e.g., "მწვანე ბამბის მოკლე ქუდი")
   - "შავი" or "შავს" = look for "შავი" in product names
   - "ყავისფერი" = look for "ყავისფერი" in product names
3. If the price discussed (e.g., "49 ლარი") matches a product price, that confirms the product
4. Extract phone number in any format (remove spaces/dashes if needed)
5. If any field is missing, use empty string "" or empty array []
6. For quantity, if not specified, assume 1
7. Address should be complete with street, building, apartment if mentioned
8. Do NOT put delivery method info in "notes" - use deliveryType and deliveryCompany fields instead
9. Return ONLY valid JSON, no other text`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract order details from this conversation:\n\n${conversation}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const extractedData = JSON.parse(completion.choices[0]?.message?.content || '{}');

    console.log('✅ Order details extracted:', extractedData);

    return NextResponse.json({
      success: true,
      data: extractedData
    });

  } catch (error: any) {
    console.error('❌ Error analyzing conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze conversation' },
      { status: 500 }
    );
  }
}

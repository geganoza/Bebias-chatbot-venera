import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// Load products for AI context
async function loadProducts(): Promise<any[]> {
  try {
    const file = path.join(process.cwd(), 'data', 'products.json');
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch (err) {
    console.error('❌ Error loading products:', err);
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
    const productContext = products
      .map((p) => `${p.name} (ID: ${p.id}) - ${p.price} ${p.currency || 'GEL'}`)
      .join('\n');

    // AI prompt to extract order details
    const systemPrompt = `You are an AI assistant that extracts order information from customer conversations in Georgian language.

# Available Products:
${productContext}

# Your Task:
Analyze the conversation and extract ALL order details. Return a JSON object with this EXACT structure:

{
  "products": [
    {
      "name": "product name with size/color (exactly as in catalog)",
      "quantity": number
    }
  ],
  "customerName": "customer's full name",
  "telephone": "phone number",
  "address": "full delivery address",
  "notes": "any additional notes or special requests"
}

# Important Rules:
1. Match product names EXACTLY to the catalog (including size/color like "M", "L", etc.)
2. If size/color is mentioned, include it in the product name (e.g., "წითელი ბამბის მოკლე ქუდი M")
3. Extract phone number in any format (remove spaces/dashes if needed)
4. If any field is missing, use empty string "" or empty array []
5. For quantity, if not specified, assume 1
6. Address should be complete with street, building, apartment if mentioned
7. Return ONLY valid JSON, no other text`;

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

// app/api/ocr/route.ts

import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const { data: { text } } = await Tesseract.recognize(
      imageUrl,
      'eng+kat', // English and Georgian
      { logger: m => console.log(m) }
    );

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Error performing OCR:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

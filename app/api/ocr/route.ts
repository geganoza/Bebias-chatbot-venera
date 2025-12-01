// app/api/ocr/route.ts

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Dynamic import to reduce bundle size
    const Tesseract = (await import('tesseract.js')).default;

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

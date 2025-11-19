import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const BOT_PAUSE_KEY = 'global_bot_paused';

export async function GET() {
  try {
    const paused = await kv.get<boolean>(BOT_PAUSE_KEY);

    return NextResponse.json({
      paused: paused || false
    });
  } catch (error) {
    console.error('❌ Error getting bot status:', error);
    return NextResponse.json(
      { error: 'Failed to get bot status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { paused } = await request.json();

    if (typeof paused !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid paused value' },
        { status: 400 }
      );
    }

    await kv.set(BOT_PAUSE_KEY, paused);

    console.log(`🤖 Bot globally ${paused ? 'PAUSED' : 'RESUMED'}`);

    return NextResponse.json({
      paused,
      message: paused ? 'Bot paused globally' : 'Bot resumed'
    });
  } catch (error) {
    console.error('❌ Error setting bot status:', error);
    return NextResponse.json(
      { error: 'Failed to set bot status' },
      { status: 500 }
    );
  }
}

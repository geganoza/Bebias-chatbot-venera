import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore';

export async function GET() {
  try {
    const settingsDoc = await db.collection('botSettings').doc('global').get();
    const paused = settingsDoc.exists ? settingsDoc.data()?.paused === true : false;

    return NextResponse.json({
      paused
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

    await db.collection('botSettings').doc('global').set({ paused });

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

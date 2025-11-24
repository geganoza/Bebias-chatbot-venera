import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore';

export async function GET() {
  try {
    const settingsDoc = await db.collection('botSettings').doc('global').get();
    const data = settingsDoc.exists ? settingsDoc.data() : {};
    const paused = data?.paused === true;
    const killSwitch = data?.killSwitch === true;

    return NextResponse.json({
      paused,
      killSwitch
    });
  } catch (error) {
    console.error('Error getting bot status:', error);
    return NextResponse.json(
      { error: 'Failed to get bot status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paused, killSwitch } = body;

    // Handle kill switch - most aggressive
    if (typeof killSwitch === 'boolean') {
      await db.collection('botSettings').doc('global').set({
        killSwitch,
        paused: killSwitch ? true : false, // Kill switch also pauses
        killSwitchActivatedAt: killSwitch ? new Date().toISOString() : null,
        killSwitchDeactivatedAt: !killSwitch ? new Date().toISOString() : null
      }, { merge: true });

      console.log(`KILL SWITCH ${killSwitch ? 'ACTIVATED' : 'DEACTIVATED'}`);

      return NextResponse.json({
        killSwitch,
        paused: killSwitch,
        message: killSwitch ? 'KILL SWITCH ACTIVATED - All processing stopped' : 'Kill switch deactivated'
      });
    }

    // Handle normal pause
    if (typeof paused === 'boolean') {
      await db.collection('botSettings').doc('global').set({
        paused,
        killSwitch: false // Resuming clears kill switch
      }, { merge: true });

      console.log(`Bot globally ${paused ? 'PAUSED' : 'RESUMED'}`);

      return NextResponse.json({
        paused,
        killSwitch: false,
        message: paused ? 'Bot paused globally' : 'Bot resumed'
      });
    }

    return NextResponse.json(
      { error: 'Invalid request - provide paused or killSwitch boolean' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error setting bot status:', error);
    return NextResponse.json(
      { error: 'Failed to set bot status' },
      { status: 500 }
    );
  }
}

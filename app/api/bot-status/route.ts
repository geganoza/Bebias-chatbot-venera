import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore';

export async function GET() {
  try {
    // Check botKillSwitch document (used by Redis batch processor)
    const killSwitchDoc = await db.collection('botSettings').doc('botKillSwitch').get();
    const killSwitchData = killSwitchDoc.exists ? killSwitchDoc.data() : {};
    const killSwitch = killSwitchData?.active === true;

    return NextResponse.json({
      paused: killSwitch, // When kill switch is active, bot is paused
      killSwitch,
      reason: killSwitchData?.reason || null,
      pausedAt: killSwitchData?.pausedAt || null
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

    // Handle kill switch toggle
    if (typeof killSwitch === 'boolean') {
      if (killSwitch) {
        // Activate kill switch
        await db.collection('botSettings').doc('botKillSwitch').set({
          active: true,
          reason: 'Paused from control panel',
          pausedAt: new Date().toISOString(),
          pausedBy: 'Control Panel'
        });

        console.log(`⛔ KILL SWITCH ACTIVATED from control panel`);

        return NextResponse.json({
          killSwitch: true,
          paused: true,
          message: 'Bot paused - all messages will be dropped'
        });
      } else {
        // Deactivate kill switch
        await db.collection('botSettings').doc('botKillSwitch').delete();

        console.log(`✅ KILL SWITCH DEACTIVATED from control panel`);

        return NextResponse.json({
          killSwitch: false,
          paused: false,
          message: 'Bot resumed - responding to messages'
        });
      }
    }

    // Handle paused toggle (same as kill switch for now)
    if (typeof paused === 'boolean') {
      if (paused) {
        await db.collection('botSettings').doc('botKillSwitch').set({
          active: true,
          reason: 'Paused from control panel',
          pausedAt: new Date().toISOString(),
          pausedBy: 'Control Panel'
        });

        return NextResponse.json({
          paused: true,
          killSwitch: true,
          message: 'Bot paused'
        });
      } else {
        await db.collection('botSettings').doc('botKillSwitch').delete();

        return NextResponse.json({
          paused: false,
          killSwitch: false,
          message: 'Bot resumed'
        });
      }
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

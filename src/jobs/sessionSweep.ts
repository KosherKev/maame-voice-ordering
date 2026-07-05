import { prisma } from '../db/prisma.js';

/**
 * Sweeps active call and USSD sessions that have been idle past the timeout limit,
 * marking them as abandoned and updating their linked orders.
 * 
 * @param timeoutSeconds The timeout limit in seconds (default 90s)
 * @returns Number of swept sessions
 */
export async function sweepAbandonedSessions(timeoutSeconds: number = 90): Promise<number> {
  const cutoffTime = new Date(Date.now() - timeoutSeconds * 1000);
  let count = 0;

  try {
    // 1. Fetch active CallSessions started before the cutoff time
    const activeCallSessions = await prisma.callSession.findMany({
      where: {
        status: 'active',
        createdAt: { lt: cutoffTime },
      },
    });

    for (const session of activeCallSessions) {
      const transcript = (session.transcript as any[]) || [];
      let isIdle = true;

      // Check the timestamp of the last turn in dialog history for active calls
      if (transcript.length > 0) {
        const lastTurn = transcript[transcript.length - 1];
        if (lastTurn.timestamp) {
          const lastTurnTime = new Date(lastTurn.timestamp);
          if (lastTurnTime >= cutoffTime) {
            isIdle = false; // Turn occurred within the cutoff window
          }
        }
      }

      if (isIdle) {
        await prisma.callSession.update({
          where: { id: session.id },
          data: {
            status: 'abandoned',
            endedAt: new Date(),
          },
        });

        if (session.orderId) {
          await markLinkedOrderAbandoned(session.orderId);
        }
        count++;
      }
    }

    // 2. Fetch active USSDSessions started before the cutoff time
    const activeUssdSessions = await prisma.uSSDSession.findMany({
      where: {
        status: 'active',
        createdAt: { lt: cutoffTime },
      },
    });

    for (const session of activeUssdSessions) {
      await prisma.uSSDSession.update({
        where: { id: session.id },
        data: {
          status: 'abandoned',
          endedAt: new Date(),
        },
      });

      if (session.orderId) {
        await markLinkedOrderAbandoned(session.orderId);
      }
      count++;
    }
  } catch (error) {
    console.error('❌ Error sweeping abandoned sessions:', error);
  }

  return count;
}

/**
 * Utility to transition a linked order to 'abandoned' if it's in a draft state
 */
async function markLinkedOrderAbandoned(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (order && (order.status === 'collecting_items' || order.status === 'confirming_order')) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'abandoned' },
    });
  }
}

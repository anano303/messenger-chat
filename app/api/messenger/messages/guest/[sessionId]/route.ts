import { NextResponse } from 'next/server';
import { getNewMessagesByPSID } from '../../../../../lib/messenger-db';

// Track what messages have been sent to each client
const sentMessages = new Map<string, Set<string>>();

export async function GET(request: Request) {
  try {
    // Extract path and query parameters
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];
    const lastTimestamp = Number(url.searchParams.get('lastTimestamp')) || 0;
    
    // Form the guest ID
    const guestId = `guest_${sessionId}`;
    
    // Get new messages since the last timestamp
    const newMessages = await getNewMessagesByPSID(guestId, lastTimestamp);
    
    // Create or get tracking set for this user
    if (!sentMessages.has(guestId)) {
      sentMessages.set(guestId, new Set());
    }
    const userSentMessages = sentMessages.get(guestId)!;
    
    // Filter out any messages we've already sent to this client
    const uniqueMessages = newMessages.filter(msg => !userSentMessages.has(msg.id));
    
    // Mark these messages as sent
    uniqueMessages.forEach(msg => userSentMessages.add(msg.id));
    
    // Clean up message tracking (keep only last 100 per user)
    if (userSentMessages.size > 100) {
      const allMessages = Array.from(userSentMessages);
      const toRemove = allMessages.slice(0, allMessages.length - 100);
      toRemove.forEach(id => userSentMessages.delete(id));
    }
    
    // Clean up users we haven't seen in a while
    const now = Date.now();
    const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
    
    if (Math.random() < 0.01) { // 1% chance of running cleanup
      for (const [key, value] of sentMessages.entries()) {
        const lastSeen = parseInt(key.split('_')[1] || '0');
        if (now - lastSeen > CLEANUP_INTERVAL) {
          sentMessages.delete(key);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      messages: uniqueMessages,
      timestamp: now
    });
  } catch (error) {
    console.error('Error fetching guest messages:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing message request' },
      { status: 500 }
    );
  }
}

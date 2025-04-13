import { NextResponse } from 'next/server';
import { createGuestUser, saveMessage, getRecentUserMessages } from '../../../lib/messenger-db';

// Keep track of processed message IDs
const processedMessages = new Set<string>();

export async function POST(request: Request) {
  try {
    const { recipientId, message, userId, clientMessageId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'შეტყობინება ცარიელია' },
        { status: 400 }
      );
    }

    // Check if we've already processed this exact message from the client
    if (clientMessageId && processedMessages.has(clientMessageId)) {
      console.log(`Duplicate message rejected: ${clientMessageId}`);
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        note: "დუბლიკატი შეტყობინება არ შეინახა"
      });
    }

    // Store client message ID to prevent duplicates
    if (clientMessageId) {
      processedMessages.add(clientMessageId);
      
      // Clean up old message IDs (keep only last 1000)
      if (processedMessages.size > 1000) {
        const toRemove = Array.from(processedMessages).slice(0, 100);
        toRemove.forEach(id => processedMessages.delete(id));
      }
    }

    // მომხმარებლის ID განსაზღვრა (სტუმარი თუ Facebook მომხმარებელი)
    let userPsid = userId;
    let isGuest = userId?.startsWith('user_') || !userId;
    
    // თუ სტუმარია, შევქმნათ/მოვძებნოთ მისი ID
    if (isGuest) {
      const guestId = userId || `guest_${Math.random().toString(36).substring(2, 10)}`;
      userPsid = await createGuestUser(guestId.replace('user_', ''));
    }

    // Check for recent duplicate messages from this user
    const recentMessages = await getRecentUserMessages(userPsid, 3);
    const isDuplicate = recentMessages.some(msg => 
      msg.text === message && 
      Date.now() - msg.timestamp < 5000 // Within last 5 seconds
    );

    if (isDuplicate) {
      console.log(`Duplicate message detected from ${userPsid}: "${message}"`);
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        note: "დუბლიკატი შეტყობინება არ შეინახა"
      });
    }

    // Use client message ID if provided, otherwise generate a new one
    const messageId = clientMessageId || `msg_${Date.now()}`;

    // შევინახოთ შეტყობინება მონაცემთა ბაზაში
    const newMessage = {
      id: messageId,
      psid: userPsid,
      text: message,
      isAdmin: false,
      timestamp: Date.now()
    };
    
    await saveMessage(newMessage);
    
    return NextResponse.json({
      success: true,
      localMessageId: newMessage.id,
      psid: userPsid,
      isGuest
    });
  } catch (error) {
    console.error('შეცდომა შეტყობინების დამუშავებისას:', error);
    return NextResponse.json(
      { success: false, error: 'სერვერის შეცდომა' },
      { status: 500 }
    );
  }
}

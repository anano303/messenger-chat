import { NextResponse } from 'next/server';
import { createGuestUser, saveMessage, getRecentUserMessages } from '../../../lib/messenger-db';

// შევინახოთ დამუშავებული შეტყობინებების ID-ები
const processedMessages = new Set<string>();

export async function POST(request: Request) {
  try {
    const { recipientId, message, userId, guestName = 'Guest', clientMessageId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'შეტყობინება ცარიელია' },
        { status: 400 }
      );
    }

    // შევამოწმოთ არის თუ არა კლიენტის ID უკვე დამუშავებული
    if (clientMessageId && processedMessages.has(clientMessageId)) {
      console.log(`დუბლიკატი შეტყობინება (${clientMessageId}): ${message}`);
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        note: "დუბლიკატი შეტყობინება არ შეინახა"
      });
    }

    // დავამატოთ კლიენტის ID დამუშავებულ სიაში
    if (clientMessageId) {
      processedMessages.add(clientMessageId);
      
      // გავასუფთავოთ ძველი ID-ები (შევინარჩუნოთ მხოლოდ ბოლო 1000)
      if (processedMessages.size > 1000) {
        const toRemove = Array.from(processedMessages).slice(0, 100);
        toRemove.forEach(id => processedMessages.delete(id));
      }
    }

    // მომხმარებლის ტიპის განსაზღვრა
    let userPsid = userId;
    const isGuest = true; // ყოველთვის მივიჩნიოთ სტუმრად, თუ ეს API გამოიყენება
    
    // შევქმნათ სტუმარი მომხმარებელი
    const guestId = userId || `guest_${Math.random().toString(36).substring(2, 10)}`;
    userPsid = await createGuestUser(guestId.replace('user_', ''));
    
    console.log(`Created/retrieved guest user: ${userPsid}`);

    // შევამოწმოთ ბოლო შეტყობინებები დუბლიკატებისთვის
    const recentMessages = await getRecentUserMessages(userPsid, 3);
    const isDuplicate = recentMessages.some(msg => 
      msg.text === message && 
      Date.now() - msg.timestamp < 5000
    );

    if (isDuplicate) {
      console.log(`დუბლიკატი შეტყობინება: ${message}`);
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        note: "დუბლიკატი შეტყობინება არ შეინახა"
      });
    }

    // შეტყობინების ID - ან კლიენტიდან მიღებული ან ახალი
    const messageId = clientMessageId || `msg_${Date.now()}`;

    // შევინახოთ შეტყობინება მონაცემთა ბაზაში - დავამატოთ სტუმრის სახელი მეტა-ინფორმაციაში
    const newMessage = {
      id: messageId,
      psid: userPsid,
      text: message,
      isAdmin: false,
      timestamp: Date.now(),
      meta: {
        guestName: guestName,
        isGuest: true
      }
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

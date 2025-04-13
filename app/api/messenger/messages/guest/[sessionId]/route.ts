import { NextResponse } from 'next/server';
import { getNewMessagesByPSID } from '../../../../../lib/messenger-db';

export async function GET(request: Request) {
  try {
    // პარამეტრების ამოღება
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];
    const lastTimestamp = Number(url.searchParams.get('lastTimestamp')) || 0;
    
    // სტუმრის ID ფორმირება
    const guestId = `guest_${sessionId}`;
    
    // დებაგ ინფორმაცია
    console.log(`Fetching messages for ${guestId} since ${new Date(lastTimestamp).toLocaleString()}`);
    
    // ახალი მესიჯების მოძიება
    const allMessages = await getNewMessagesByPSID(guestId, lastTimestamp);
    
    // დებაგ ინფორმაცია, რამდენი მესიჯი მოიძებნა
    console.log(`Found ${allMessages.length} messages since ${new Date(lastTimestamp).toLocaleString()}`);
    
    // თავიდან ავიცილოთ დუბლიკატები
    const uniqueMessages = Array.from(
      new Map(allMessages.map(msg => [msg.id, msg])).values()
    );
    
    return NextResponse.json({
      success: true,
      messages: uniqueMessages,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching guest messages:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing message request' },
      { status: 500 }
    );
  }
}

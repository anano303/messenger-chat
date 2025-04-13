import { NextResponse } from 'next/server';
import { getUserByPSID, saveMessage } from '../../../../lib/messenger-db';

export async function POST(request: Request) {
  try {
    const { recipientId, message, isAdmin } = await request.json();
    
    if (!recipientId || !message) {
      return NextResponse.json(
        { success: false, error: 'არასრული მონაცემები' },
        { status: 400 }
      );
    }
    
    const user = await getUserByPSID(recipientId);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'მომხმარებელი არ მოიძებნა' },
        { status: 404 }
      );
    }
    
    // შევქმნათ და შევინახოთ ადმინის შეტყობინება
    const newMessage = {
      id: `admin_${Date.now()}`,
      psid: recipientId,
      text: message,
      isAdmin: true,
      timestamp: Date.now()
    };
    
    const savedMessage = await saveMessage(newMessage);
    
    console.log(`ადმინის პასუხი შენახულია: ${recipientId}, შეტყობინება: "${message.substring(0, 20)}${message.length > 20 ? '...' : ''}"`);
    
    // თუ მომხმარებელი Facebook-იდან არის და არა სტუმარი, 
    // Facebook API-ს გამოყენებით გავაგზავნოთ
    if (!user.isGuest && process.env.NODE_ENV === 'production') {
      // პროდაქშენ გარემოში გამოვიყენებთ Facebook API-ს
      try {
        const pageAccessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
        
        if (pageAccessToken) {
          const response = await fetch(
            `https://graph.facebook.com/v22.0/me/messages?access_token=${pageAccessToken}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipient: {
                  id: recipientId
                },
                message: {
                  text: message
                }
              }),
            }
          );
          
          if (!response.ok) {
            const data = await response.json();
            console.error('Facebook API შეცდომა:', data);
          }
        }
      } catch (error) {
        console.error('Facebook-თან დაკავშირების შეცდომა:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      messageId: savedMessage.id,
      message: savedMessage,
      deliveredToGuest: user.isGuest
    });
    
  } catch (error) {
    console.error('შეტყობინების გაგზავნის შეცდომა:', error);
    return NextResponse.json(
      { success: false, error: 'შეტყობინების გაგზავნისას მოხდა შეცდომა' },
      { status: 500 }
    );
  }
}

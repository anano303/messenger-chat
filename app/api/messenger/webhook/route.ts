import { NextResponse } from 'next/server';
import { saveUserPSID } from '../../../lib/messenger-db';

// მოხდეს Facebook Webhook-ის ვერიფიკაცია
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  
  // შევამოწმოთ ტოკენი
  const verifyToken = process.env.MESSENGER_VERIFY_TOKEN;
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook ვერიფიკაცია წარმატებულია');
    return new NextResponse(challenge || '', { status: 200 });
  } else {
    console.error('Webhook ვერიფიკაციის შეცდომა');
    return new NextResponse('ვერიფიკაცია წარუმატებელია', { status: 403 });
  }
}

// მივიღოთ შეტყობინებები Facebook-იდან
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // შევამოწმოთ, არის თუ არა ეს მოვლენა გვერდის გამოწერიდან
    if (body.object === 'page') {
      // დავამუშაოთ თითოეული ჩანაწერი
      for (const entry of body.entry) {
        // დავამუშაოთ შეტყობინებები
        const webhookEvent = entry.messaging?.[0];
        if (webhookEvent) {
          const senderId = webhookEvent.sender.id;
          
          // თუ შეტყობინებას ვიღებთ, შევინახოთ მომხმარებლის PSID
          if (webhookEvent.message) {
            console.log('შეტყობინება მიღებულია:', webhookEvent.message);
            
            // შევინახოთ მომხმარებლის PSID მონაცემთა ბაზაში
            await saveUserPSID(senderId, {
              lastActive: new Date().toISOString(),
              lastMessage: webhookEvent.message.text || '',
            });
          }
        }
      }

      // დავაბრუნოთ 200 OK პასუხი - Facebook-ის მოთხოვნაა
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    } else {
      return new NextResponse('არ არის გვერდის მოვლენა', { status: 404 });
    }
  } catch (error) {
    console.error('webhook დამუშავების შეცდომა:', error);
    return new NextResponse('webhook დამუშავების შეცდომა', { status: 500 });
  }
}

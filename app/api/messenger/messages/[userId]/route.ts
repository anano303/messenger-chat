import { NextResponse } from 'next/server';
import { getMessagesByPSID } from '../../../../lib/messenger-db';

export async function GET(request: Request) {
  try {
    // Extract userId from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];
    
    if (!userId) {
      return NextResponse.json(
        { error: 'მომხმარებლის ID არ არის მითითებული' },
        { status: 400 }
      );
    }
    
    const messages = await getMessagesByPSID(userId);
    
    // დავალაგოთ შეტყობინებები დროის მიხედვით
    messages.sort((a, b) => a.timestamp - b.timestamp);
    
    return NextResponse.json({ 
      success: true, 
      messages,
      userId
    });
    
  } catch (error) {
    console.error('შეტყობინებების მიღების შეცდომა:', error);
    return NextResponse.json(
      { error: 'შეტყობინებების მიღებისას მოხდა შეცდომა' },
      { status: 500 }
    );
  }
}

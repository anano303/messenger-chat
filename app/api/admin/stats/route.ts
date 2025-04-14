import { NextResponse } from 'next/server';
import { getUsers, getMessages } from '../../../lib/messenger-db';

export async function GET() {
  try {
    // Get stats about our data
    const users = await getUsers();
    const messages = await getMessages();

    // Calculate stats
    const userCount = Object.keys(users).length;
    const guestCount = Object.values(users).filter(user => user.isGuest).length;
    const fbCount = Object.values(users).filter(user => !user.isGuest).length;
    const messageCount = messages.length;
    const adminMessages = messages.filter(msg => msg.isAdmin).length;
    const userMessages = messages.filter(msg => !msg.isAdmin).length;
    
    // Return stats and samples
    return NextResponse.json({
      environment: process.env.NODE_ENV,
      database: {
        uri: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 20) + '...' : 'Not configured',
        connected: !!process.env.MONGODB_URI,
        dbName: 'soulartChat'
      },
      stats: {
        users: userCount,
        guests: guestCount,
        fbUsers: fbCount,
        messages: messageCount,
        adminMessages,
        userMessages
      },
      userSample: Object.keys(users).slice(0, 5),
      messageSample: messages.slice(-5).map(msg => ({
        id: msg.id,
        from: msg.isAdmin ? 'admin' : 'user',
        text: msg.text.substring(0, 30) + (msg.text.length > 30 ? '...' : ''),
        time: new Date(msg.timestamp).toISOString()
      }))
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

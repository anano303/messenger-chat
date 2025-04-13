import { NextResponse } from 'next/server';
import { getUsers } from '../../../lib/messenger-db';

export async function GET() {
  try {
    const users = await getUsers();
    
    // დავალაგოთ მომხმარებლები ბოლო აქტივობის მიხედვით (ახალი პირველი)
    const sortedUsers = Object.values(users).sort((a, b) => {
      return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
    });
    
    // გადავიყვანოთ უკან ობიექტში
    const usersObj = sortedUsers.reduce<Record<string, any>>((acc, user) => {
      acc[user.psid] = user;
      return acc;
    }, {});
    
    return NextResponse.json({
      users: usersObj,
      count: sortedUsers.length
    });
  } catch (error) {
    console.error('მომხმარებლების მიღების შეცდომა:', error);
    return NextResponse.json(
      { error: 'შეცდომა მოხდა მონაცემების მიღებისას' },
      { status: 500 }
    );
  }
}

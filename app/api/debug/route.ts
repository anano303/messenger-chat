import { NextResponse } from 'next/server';

export async function GET() {
  // Only expose this in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ message: 'Debug endpoint only available in development' }, { status: 403 });
  }
  
  // Show all environment variables that are related to Messenger/Facebook
  // but mask sensitive data
  const envVars = Object.entries(process.env)
    .filter(([key]) => key.includes('MESSENGER') || key.includes('FACEBOOK'))
    .map(([key, value]) => {
      if (key === 'MESSENGER_PAGE_ACCESS_TOKEN' && value) {
        return [key, `${value.substring(0, 10)}...${value.substring(value.length - 5)} (length: ${value.length})`];
      }
      return [key, value];
    });
  
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    variables: Object.fromEntries(envVars),
  });
}

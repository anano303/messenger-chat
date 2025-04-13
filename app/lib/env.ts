// Helper function to safely access environment variables
export function getEnv(key: string, defaultValue: string = ''): string {
  if (typeof window !== 'undefined' && key.startsWith('NEXT_PUBLIC_')) {
    return process.env[key] || defaultValue;
  }
  return process.env[key] || defaultValue;
}

// Expose messenger-specific environment variables
export const messengerConfig = {
  pageId: getEnv('NEXT_PUBLIC_FACEBOOK_PAGE_ID', '542501458957000'),
  appId: getEnv('NEXT_PUBLIC_FACEBOOK_APP_ID', '2385644865136914'),
  pageAccessToken: getEnv('MESSENGER_PAGE_ACCESS_TOKEN', ''),
  verifyToken: getEnv('MESSENGER_VERIFY_TOKEN', ''),
  
  // Debug mode - set to false in production
  debugMode: process.env.NODE_ENV === 'development',
  
  // Long polling interval (in ms) to reduce requests
  pollingInterval: 15000,
};

import fs from 'fs';
import path from 'path';

// Let's create a memory store for Vercel environment where file system isn't persistable
let inMemoryUsers: Record<string, UserData> = {};
let inMemoryMessages: Message[] = [];

// Check if we're in production environment (like Vercel)
const isProduction = process.env.NODE_ENV === 'production';

// მარტივი ფაილური ბაზა განვითარებისთვის
const DB_FILE = path.join(process.cwd(), 'messenger-users.json');
const MESSAGES_FILE = path.join(process.cwd(), 'messenger-messages.json');

// Make sure the files exist
function ensureFilesExist() {
  if (!isProduction) {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf8');
    }
    if (!fs.existsSync(MESSAGES_FILE)) {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]), 'utf8');
    }
  }
}

// Call this on startup
ensureFilesExist();

// Load initial data if in production (will be lost on cold starts, but helps during the session)
if (isProduction) {
  try {
    // Try to load from environment variables if set
    const usersData = process.env.STORED_USERS_DATA;
    const messagesData = process.env.STORED_MESSAGES_DATA;
    
    if (usersData) {
      inMemoryUsers = JSON.parse(usersData);
    }
    
    if (messagesData) {
      inMemoryMessages = JSON.parse(messagesData);
    }
  } catch (error) {
    console.error('Error loading stored data:', error);
  }
}

interface UserData {
  psid: string;
  lastActive: string;
  lastMessage?: string;
  name?: string;
  isGuest?: boolean;
}

interface Message {
  id: string;
  psid: string; // მომხმარებლის ID
  text: string;
  isAdmin: boolean; // არის თუ არა ადმინის გაგზავნილი
  timestamp: number;
  meta?: {
    guestName?: string;
    [key: string]: any;
  };
}

// წავიკითხოთ მომხმარებლების ბაზა
export async function getUsers(): Promise<Record<string, UserData>> {
  if (isProduction) {
    return inMemoryUsers;
  }
  
  try {
    ensureFilesExist();
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('მომხმარებლების წაკითხვის შეცდომა:', error);
    return {};
  }
}

// შევინახოთ მომხმარებლის PSID
export async function saveUserPSID(psid: string, data: Partial<UserData>): Promise<void> {
  try {
    if (isProduction) {
      // In memory storage for production
      inMemoryUsers[psid] = {
        ...(inMemoryUsers[psid] || {}),
        psid,
        ...data,
      };
      return;
    }
    
    // Local file storage for development
    ensureFilesExist();
    const users = await getUsers();
    
    users[psid] = {
      ...(users[psid] || {}),
      psid,
      ...data,
    };
    
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log(`შენახულია მომხმარებელი PSID-ით: ${psid}`);
  } catch (error) {
    console.error('მომხმარებლის შენახვის შეცდომა:', error);
  }
}

// მივიღოთ ყველა შენახული მომხმარებლის PSID
export async function getAllPSIDs(): Promise<string[]> {
  const users = await getUsers();
  return Object.keys(users);
}

// შევქმნათ სტუმარი მომხმარებელი
export async function createGuestUser(tempId: string): Promise<string> {
  const guestPSID = `guest_${tempId}`;
  
  // ცხადად მივუთითოთ რომ ეს სტუმარი მომხმარებელია
  await saveUserPSID(guestPSID, {
    lastActive: new Date().toISOString(),
    isGuest: true,
    name: "Guest" // დეფოლტად სტუმრის სახელი
  });
  
  return guestPSID;
}

// მივიღოთ კონკრეტული მომხმარებლის მონაცემები
export async function getUserByPSID(psid: string): Promise<UserData | null> {
  const users = await getUsers();
  return users[psid] || null;
}

// შეტყობინებების ოპერაციები

// წავიკითხოთ ყველა შეტყობინება
export async function getMessages(): Promise<Message[]> {
  if (isProduction) {
    return inMemoryMessages;
  }
  
  try {
    ensureFilesExist();
    const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('შეტყობინებების წაკითხვის შეცდომა:', error);
    return [];
  }
}

// შევინახოთ შეტყობინება და დავაბრუნოთ შენახული შეტყობინება
export async function saveMessage(message: Message): Promise<Message> {
  try {
    if (isProduction) {
      // In memory storage for production
      inMemoryMessages.push(message);
      
      // Update user info
      await saveUserPSID(message.psid, {
        lastMessage: message.text,
        lastActive: new Date().toISOString(),
        name: message.meta?.guestName || undefined
      });
      
      console.log(`შეტყობინება შენახულია (memory): ${message.isAdmin ? 'ადმინისგან' : 'სტუმრისგან'} ID=${message.psid}${message.meta?.guestName ? ` (${message.meta.guestName})` : ''}`);
      return message;
    }
    
    // Local file storage for development
    ensureFilesExist();
    const messages = await getMessages();
    
    // დავამატოთ შეტყობინება ბაზაში
    messages.push(message);
    
    // განვაახლოთ მომხმარებლის ბოლო შეტყობინება და აქტიურობა
    await saveUserPSID(message.psid, {
      lastMessage: message.text,
      lastActive: new Date().toISOString(),
      // შევინახოთ სტუმრის სახელი თუ არსებობს
      name: message.meta?.guestName || undefined
    });
    
    // შევინახოთ შეტყობინებების მასივი
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
    
    // Debug logging
    console.log(`შეტყობინება შენახულია (file): ${message.isAdmin ? 'ადმინისგან' : 'სტუმრისგან'} ID=${message.psid}${message.meta?.guestName ? ` (${message.meta.guestName})` : ''}`);
    
    return message;
  } catch (error) {
    console.error('შეტყობინების შენახვის შეცდომა:', error);
    return message;
  }
}

// მივიღოთ კონკრეტული მომხმარებლის შეტყობინებები
export async function getMessagesByPSID(psid: string): Promise<Message[]> {
  const allMessages = await getMessages();
  
  // დავაბრუნოთ მხოლოდ მოცემული მომხმარებლის შეტყობინებები
  return allMessages.filter(message => message.psid === psid);
}

// მივიღოთ ახალი შეტყობინებები მოცემული თარიღის შემდეგ
export async function getNewMessagesByPSID(psid: string, timestamp: number): Promise<Message[]> {
  const allMessages = await getMessages();
  
  // მივიღოთ შეტყობინებები:
  // 1. მომხმარებლის საკუთარი შეტყობინებები
  // 2. ადმინისტრატორის პასუხები ამ მომხმარებლისთვის
  const messages = allMessages.filter(message => {
    // ჩავრთოთ მომხმარებლის შეტყობინებები
    const isUserMessage = message.psid === psid && !message.isAdmin;
    // ჩავრთოთ ადმინის პასუხები მომხმარებელს
    const isAdminReplyToUser = message.psid === psid && message.isAdmin === true;
    
    return isUserMessage || isAdminReplyToUser;
  });
  
  console.log(`Found ${messages.length} total messages for ${psid}`);
  
  // ფილტრაცია დროის მიხედვით
  const newMessages = messages.filter(message => message.timestamp > timestamp);
  
  // განვახორციელოთ დებაგ ლოგირება
  console.log(`getNewMessagesByPSID: Found ${newMessages.length}/${messages.length} new messages for ${psid} since ${new Date(timestamp).toISOString()}`);
  
  // დავბეჭდოთ მესიჯების დეტალები
  if(newMessages.length > 0) {
    newMessages.forEach(msg => {
      console.log(`- Message ${msg.id}: "${msg.text.substring(0, 30)}" - Admin: ${msg.isAdmin}, Time: ${new Date(msg.timestamp).toLocaleString()}`);
    });
  }
  
  return newMessages;
}

// Get most recent messages for a specific user
export async function getRecentUserMessages(psid: string, count: number = 5): Promise<Message[]> {
  const allMessages = await getMessages();
  
  // Filter by user and sort by timestamp (newest first)
  const userMessages = allMessages
    .filter(message => message.psid === psid && !message.isAdmin)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, count);
  
  return userMessages;
}

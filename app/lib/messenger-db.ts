import fs from 'fs';
import path from 'path';

// მარტივი ფაილური ბაზა განვითარებისთვის
const DB_FILE = path.join(process.cwd(), 'messenger-users.json');
const MESSAGES_FILE = path.join(process.cwd(), 'messenger-messages.json');

// Make sure the files exist
function ensureFilesExist() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf8');
  }
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]), 'utf8');
  }
}

// Call this on startup
ensureFilesExist();

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
}

// წავიკითხოთ მომხმარებლების ბაზა
export async function getUsers(): Promise<Record<string, UserData>> {
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
  
  await saveUserPSID(guestPSID, {
    lastActive: new Date().toISOString(),
    isGuest: true,
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
    ensureFilesExist();
    const messages = await getMessages();
    
    // დავამატოთ შეტყობინება ბაზაში
    messages.push(message);
    
    // განვაახლოთ მომხმარებლის ბოლო შეტყობინება და აქტიურობა
    await saveUserPSID(message.psid, {
      lastMessage: message.text,
      lastActive: new Date().toISOString()
    });
    
    // შევინახოთ შეტყობინებების მასივი
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
    
    // Debug logging
    console.log(`შეტყობინება შენახულია: ${message.isAdmin ? 'ადმინისგან' : 'სტუმრისგან'} ID=${message.psid}`);
    
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
  const messages = await getMessagesByPSID(psid);
  const newMessages = messages.filter(message => message.timestamp > timestamp);
  
  // Debug logging to verify messages are being filtered correctly
  console.log(`getNewMessagesByPSID: Found ${newMessages.length}/${messages.length} new messages for ${psid} since ${new Date(timestamp).toISOString()}`);
  
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

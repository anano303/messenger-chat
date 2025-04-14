import { getCollection } from './mongodb';
import { ObjectId, Document } from 'mongodb';

// User data interface with MongoDB compatibility
interface UserData {
  _id?: ObjectId;
  psid: string;
  lastActive: string;
  lastMessage?: string;
  name?: string;
  isGuest?: boolean;
  updatedAt?: Date;
}

// Message interface with MongoDB compatibility
interface Message {
  _id?: ObjectId;
  id: string;
  psid: string;
  text: string;
  isAdmin: boolean;
  timestamp: number;
  meta?: {
    guestName?: string;
    [key: string]: any;
  };
  createdAt?: Date;
}

// Get users collection
async function getUsersCollection() {
  return getCollection('users');
}

// Get messages collection
async function getMessagesCollection() {
  return getCollection('messages');
}

// წავიკითხოთ მომხმარებლების ბაზა
export async function getUsers(): Promise<Record<string, UserData>> {
  try {
    const collection = await getUsersCollection();
    const users = await collection.find({}).toArray();
    
    // Convert array to object with psid as key
    return users.reduce((acc: Record<string, UserData>, user) => {
      // Convert MongoDB document to UserData
      const userData: UserData = {
        psid: user.psid,
        lastActive: user.lastActive,
        lastMessage: user.lastMessage,
        name: user.name,
        isGuest: user.isGuest,
        updatedAt: user.updatedAt,
        _id: user._id
      };
      acc[user.psid] = userData;
      return acc;
    }, {});
  } catch (error) {
    console.error('მომხმარებლების წაკითხვის შეცდომა:', error);
    return {};
  }
}

// შევინახოთ მომხმარებლის PSID
export async function saveUserPSID(psid: string, data: Partial<UserData>): Promise<void> {
  try {
    const collection = await getUsersCollection();
    
    // Build the update document, ensuring _id is not included
    const updateData: Partial<UserData> = {
      ...data,
      psid,
      updatedAt: new Date()
    };
    
    // Remove _id if present to avoid update errors
    delete updateData._id;
    
    // Try to find and update existing user
    const updateResult = await collection.updateOne(
      { psid },
      { $set: updateData },
      { upsert: true }
    );
    
    console.log(`შენახულია მომხმარებელი PSID-ით: ${psid}, inserted: ${updateResult.upsertedCount}, modified: ${updateResult.modifiedCount}`);
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
export async function createGuestUser(tempId: string, name: string = 'სტუმარი'): Promise<string> {
  const guestPSID = `guest_${tempId}`;
  
  console.log(`MongoDB: ვქმნით/ვაახლებთ მომხმარებელს ID=${guestPSID}, სახელი=${name}`);
  
  // შევამოწმოთ არსებობს თუ არა ეს მომხმარებელი ბაზაში
  const existingUser = await getUserByPSID(guestPSID);
  
  if (existingUser) {
    // განვაახლოთ მომხმარებელი ახალი სახელით, თუ ის არ არის სტანდარტული
    if (name && name !== 'Guest' && name !== 'სტუმარი') {
      await saveUserPSID(guestPSID, {
        lastActive: new Date().toISOString(),
        isGuest: true,
        name: name
      });
      console.log(`MongoDB: მომხმარებლის სახელი განახლდა: ${guestPSID} -> ${name}`);
    } else {
      // თუ სტანდარტული სახელია და უკვე გვაქვს უკეთესი სახელი, არ შევცვალოთ
      await saveUserPSID(guestPSID, {
        lastActive: new Date().toISOString(),
        isGuest: true
      });
      console.log(`MongoDB: მომხმარებლის აქტივობა განახლდა: ${guestPSID}`);
    }
  } else {
    // შევქმნათ ახალი მომხმარებელი
    await saveUserPSID(guestPSID, {
      lastActive: new Date().toISOString(),
      isGuest: true,
      name: name
    });
    console.log(`MongoDB: ახალი მომხმარებელი შექმნილია: ${guestPSID}, სახელი: ${name}`);
  }
  
  return guestPSID;
}

// მივიღოთ კონკრეტული მომხმარებლის მონაცემები
export async function getUserByPSID(psid: string): Promise<UserData | null> {
  try {
    const collection = await getUsersCollection();
    const user = await collection.findOne({ psid });
    return user as UserData | null;
  } catch (error) {
    console.error('მომხმარებლის მოძიების შეცდომა:', error);
    return null;
  }
}

// შეტყობინებების ოპერაციები

// წავიკითხოთ ყველა შეტყობინება
export async function getMessages(): Promise<Message[]> {
  try {
    const collection = await getMessagesCollection();
    const messages = await collection.find({}).toArray();
    return messages.map(msg => ({
      ...msg,
      _id: msg._id
    })) as Message[];
  } catch (error) {
    console.error('შეტყობინებების წაკითხვის შეცდომა:', error);
    return [];
  }
}

// შევინახოთ შეტყობინება და დავაბრუნოთ შენახული შეტყობინება
export async function saveMessage(message: Message): Promise<Message> {
  try {
    const collection = await getMessagesCollection();
    
    // მისალმების შეტყობინების დეტექცია - რომ დავრწმუნდეთ რომ სახელი გამოჩნდება
    if (message.text.includes('გამარჯობა') && message.isAdmin) {
      console.log(`შევინახოთ მისალმების შეტყობინება: "${message.text}"`);
    }
    
    // Prepare the message document for MongoDB
    const messageDoc: Omit<Message, '_id'> & { createdAt: Date } = {
      id: message.id,
      psid: message.psid,
      text: message.text,
      isAdmin: message.isAdmin,
      timestamp: message.timestamp,
      meta: message.meta,
      createdAt: new Date()
    };
    
    // შევინახოთ შეტყობინება
    const result = await collection.insertOne(messageDoc as any);
    
    // განვაახლოთ მომხმარებლის ინფორმაცია - გვინდა სახელიც შენარჩუნდეს
    const userData: Partial<UserData> = {
      lastMessage: message.text,
      lastActive: new Date().toISOString(),
    };
    
    // თუ გვაქვს გესტის სახელი მეტაში და ის არაა გასთი/სტუმარი, შევინახოთ
    if (message.meta?.guestName && 
        message.meta.guestName !== 'Guest' && 
        message.meta.guestName !== 'სტუმარი') {
      userData.name = message.meta.guestName;
    }
    
    await saveUserPSID(message.psid, userData);
    
    // Debug logging
    console.log(`Message saved: ${message.isAdmin ? 'From Admin' : 'From Guest'} ID=${message.psid}${message.meta?.guestName ? ` (${message.meta.guestName})` : ''}`);
    
    // Return the message with the new MongoDB _id
    return {
      ...message,
      _id: result.insertedId
    };
  } catch (error) {
    console.error('შეტყობინების შენახვის შეცდომა:', error);
    return message;
  }
}

// მივიღოთ კონკრეტული მომხმარებლის შეტყობინებები
export async function getMessagesByPSID(psid: string): Promise<Message[]> {
  try {
    const collection = await getMessagesCollection();
    const messages = await collection.find({ psid }).toArray();
    
    // Map MongoDB documents to Message objects
    return messages.map(msg => ({
      id: msg.id,
      psid: msg.psid,
      text: msg.text,
      isAdmin: msg.isAdmin,
      timestamp: msg.timestamp,
      meta: msg.meta,
      _id: msg._id
    }));
  } catch (error) {
    console.error(`Error fetching messages for ${psid}:`, error);
    return [];
  }
}

// მივიღოთ ახალი შეტყობინებები მოცემული თარიღის შემდეგ
export async function getNewMessagesByPSID(psid: string, timestamp: number): Promise<Message[]> {
  try {
    const collection = await getMessagesCollection();
    
    // Find messages for this user with timestamp greater than provided
    const messages = await collection.find({
      psid,
      timestamp: { $gt: timestamp }
    }).toArray();
    
    console.log(`Found ${messages.length} total new messages for ${psid} since ${new Date(timestamp).toISOString()}`);
    
    if (messages.length > 0) {
      messages.forEach(msg => {
        console.log(`- Message ${msg.id}: "${msg.text.substring(0, 30)}" - Admin: ${msg.isAdmin}, Time: ${new Date(msg.timestamp).toLocaleString()}`);
      });
    }
    
    // Map MongoDB documents to Message objects
    return messages.map(msg => ({
      id: msg.id,
      psid: msg.psid,
      text: msg.text,
      isAdmin: msg.isAdmin,
      timestamp: msg.timestamp,
      meta: msg.meta,
      _id: msg._id
    }));
  } catch (error) {
    console.error(`Error fetching new messages for ${psid}:`, error);
    return [];
  }
}

// Get most recent messages for a specific user
export async function getRecentUserMessages(psid: string, count: number = 5): Promise<Message[]> {
  try {
    const collection = await getMessagesCollection();
    
    // Find the most recent messages from this user (not admin messages)
    const messages = await collection
      .find({ psid, isAdmin: false })
      .sort({ timestamp: -1 })
      .limit(count)
      .toArray();
    
    // Map MongoDB documents to Message objects
    return messages.map(msg => ({
      id: msg.id,
      psid: msg.psid,
      text: msg.text,
      isAdmin: msg.isAdmin,
      timestamp: msg.timestamp,
      meta: msg.meta,
      _id: msg._id
    }));
  } catch (error) {
    console.error(`Error fetching recent messages for ${psid}:`, error);
    return [];
  }
}

import { MongoClient, ServerApiVersion, Db, Collection } from 'mongodb';

// Connection URI taken from environment variables
const uri = process.env.MONGODB_URI || 'mongodb+srv://soulartani:Qazqaz111@soulart.b16ew.mongodb.net/soulartChat?retryWrites=true&w=majority&appName=SoulArt';
const dbName = 'soulartChat';

// Define type for the global variable
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Create a MongoClient with options
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Cache client connection promise
let clientPromise: Promise<MongoClient>;

if (!global._mongoClientPromise) {
  try {
    global._mongoClientPromise = client.connect();
    console.log('MongoDB connection initialized');
  } catch (e) {
    console.error('MongoDB connection failed:', e);
    throw e;
  }
}

clientPromise = global._mongoClientPromise;

// Get the database instance
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

// Get a collection with proper typing
export async function getCollection(collectionName: string): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(collectionName);
}

// Export the clientPromise for use elsewhere
export default clientPromise;

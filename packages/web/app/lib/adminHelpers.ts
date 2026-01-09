import { ObjectId } from "mongodb";
import { getMongoClient } from "./mongo";

/**
 * Get the users collection from BetterAuth database
 * Returns both the collection and client.
 * 
 * ⚠️ IMPORTANT: Do NOT close the mongoClient - it's a shared singleton.
 * Closing it will break other routes. The MongoDB driver manages connection pooling automatically.
 */
export async function getUsersCollection() {
  const client = await getMongoClient();
  
  if (!client) {
    throw new Error("Failed to get MongoDB client: client is null. Please check your MONGODB_URI environment variable and ensure the database is accessible.");
  }
  
  const db = client.db("nowgai");
  const usersCollection = db.collection("user");
  
  return {
    usersCollection,
    mongoClient: client,
  };
}

/**
 * Convert string ID to MongoDB ObjectId
 */
export function toObjectId(id: string | ObjectId): ObjectId {
  if (id instanceof ObjectId) return id;
  if (ObjectId.isValid(id)) return new ObjectId(id);
  throw new Error(`Invalid ObjectId: ${id}`);
}


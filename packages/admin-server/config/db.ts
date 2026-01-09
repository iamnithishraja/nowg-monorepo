import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { MongoClient } from "mongodb";

let mongooseConnected = false;
let mongoClient: MongoClient | null = null;

/**
 * Fix the token index on orguserinvitations collection
 * The index needs to be sparse to allow multiple documents without a token field
 */
async function fixOrgUserInvitationIndex() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const collection = db.collection("orguserinvitations");

    // Get existing indexes
    const indexes = await collection.indexes();
    const tokenIndex = indexes.find(
      (idx) => idx.key && idx.key.token !== undefined
    );

    if (tokenIndex && !tokenIndex.sparse) {
      console.log(
        "🔧 Fixing orguserinvitations token index (adding sparse option)..."
      );

      // First, clean up any documents with null token values
      await collection.updateMany(
        { token: null },
        { $unset: { token: 1 } }
      );

      // Drop the old non-sparse index
      await collection.dropIndex("token_1");

      // Recreate as sparse unique index
      await collection.createIndex(
        { token: 1 },
        { unique: true, sparse: true }
      );

      console.log("✅ orguserinvitations token index fixed successfully");
    }
  } catch (error: any) {
    // Index might not exist or already be correct
    if (!error.message?.includes("index not found")) {
      console.log(
        "ℹ️ orguserinvitations index check:",
        error.message || "Already correct"
      );
    }
  }
}

export async function connectToDatabase() {
  if (mongooseConnected) {
    return;
  }

  const uri = process.env.MONGODB_URI || process.env.DB_URL;
  if (!uri) {
    throw new Error("MONGODB_URI or DB_URL environment variable is not set");
  }

  try {
    // Connect Mongoose for models
    await mongoose.connect(uri, {
      dbName: "nowgai",
    });

    mongooseConnected = true;
    console.log("✅ Connected to MongoDB (Mongoose) successfully");

    // Fix indexes after connection
    await fixOrgUserInvitationIndex();

    // Connect MongoDB client for BetterAuth user collection
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    console.log("✅ Connected to MongoDB (Client) successfully");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw new Error(
      `MongoDB connection failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function getMongoClient(): MongoClient {
  if (!mongoClient) {
    throw new Error(
      "MongoDB client not initialized. Call connectToDatabase() first."
    );
  }
  return mongoClient;
}

export function getUsersCollection() {
  const client = getMongoClient();
  const db = client.db("nowgai");
  return db.collection("user");
}

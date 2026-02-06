import mongoose from "mongoose";
import { MongoClient } from "mongodb";
import { loadEnvFromDatabase } from "./env";

let isConnected = false;
let mongoClient: MongoClient | null = null;
let mongoClientPromise: Promise<MongoClient> | null = null;
let envLoaded = false; // Track if env has been loaded

async function connectToDatabase() {
  // Check if connection is actually alive, not just the flag
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // If connection state indicates it's closed or closing, reset the flag
  if (
    mongoose.connection.readyState === 0 ||
    mongoose.connection.readyState === 3
  ) {
    isConnected = false;  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  try {
    // If already connecting, wait for it
    if (mongoose.connection.readyState === 2) {
      await new Promise((resolve, reject) => {
        mongoose.connection.once("connected", resolve);
        mongoose.connection.once("error", reject);
        setTimeout(() => reject(new Error("Connection timeout")), 10000);
      });
      isConnected = true;
      return;
    }

    // Connect or reconnect
    const dbName = process.env.MONGODB_DB_NAME || "nowgai";
    await mongoose.connect(uri, {
      dbName,
    });

    isConnected = true;

    // Load environment variables from MongoDB after connection
    // This happens only once on server startup
    if (!envLoaded) {
      try {
        await loadEnvFromDatabase();
        envLoaded = true;
      } catch (error) {
        // Don't throw here - allow app to continue with process.env fallback
      }
    }

    // Set up connection event handlers to reset flag on disconnect
    mongoose.connection.on("disconnected", () => {
      isConnected = false;
    });

    mongoose.connection.on("error", (error) => {
      isConnected = false;
    });
  } catch (error) {
    isConnected = false;
    throw new Error(
      `MongoDB connection failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get MongoDB client for BetterAuth database access
 * Creates a separate client from Mongoose connection
 * Uses lazy initialization to avoid circular dependencies
 */
export async function getMongoClient(): Promise<MongoClient> {
  // If we already have a client, try to verify it's still connected
  if (mongoClient) {
    try {
      // Simple ping to verify connection is alive
      await mongoClient.db("admin").command({ ping: 1 });
      return mongoClient;
    } catch (error) {
      // Connection is dead, reset it
      mongoClient = null;
    }
  }

  // If there's already a connection in progress, wait for it
  if (mongoClientPromise) {
    try {
      const client = await mongoClientPromise;
      if (!client) {
        throw new Error(
          "Failed to get MongoDB client: connection promise resolved to null"
        );
      }
      return client;
    } catch (error) {
      // If the promise failed, clear it so we can retry
      mongoClientPromise = null;
      throw error;
    }
  }

  // Create new connection
  const promise = (async () => {
    try {
      const connectionString = process.env.MONGODB_URI;
      if (!connectionString) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      // Ensure Mongoose is connected first
      await connectToDatabase();

      // Create and connect MongoDB client
      // Always create a new client if we don't have one
      if (!mongoClient) {
        mongoClient = new MongoClient(connectionString, {
          maxPoolSize: 10,
          minPoolSize: 1,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        await mongoClient.connect();
      }

      if (!mongoClient) {
        throw new Error("Failed to create MongoDB client: client is null");
      }

      // Verify connection is alive
      await mongoClient.db("admin").command({ ping: 1 });

      return mongoClient;
    } catch (error) {
      // Reset client on error
      if (mongoClient) {
        mongoClient = null;
      }
      throw error;
    } finally {
      // Always clear the promise reference, whether success or failure
      mongoClientPromise = null;
    }
  })();

  // Store the promise reference before awaiting
  mongoClientPromise = promise;

  try {
    const client = await promise;
    if (!client) {
      throw new Error(
        "Failed to get MongoDB client: connection promise resolved to null"
      );
    }
    return client;
  } catch (error) {
    // Re-throw with more context
    throw new Error(
      `Failed to create MongoDB client: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Alias for Better Auth compatibility
export { connectToDatabase };

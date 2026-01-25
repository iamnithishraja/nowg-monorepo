import mongoose from "mongoose";

let isConnected = false;
let connectionPromise: Promise<typeof mongoose> | null = null;

export interface MongoDBConnectionOptions {
  uri?: string;
  dbName?: string;
  serverSelectionTimeoutMS?: number;
  socketTimeoutMS?: number;
  maxPoolSize?: number;
  minPoolSize?: number;
}

/**
 * Connect to MongoDB using mongoose
 * Handles connection pooling and reconnection logic
 */
export async function connectToMongoDB(
  options: MongoDBConnectionOptions = {}
): Promise<typeof mongoose> {
  // If already connected, return immediately
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If a connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = options.uri || process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = options.dbName || process.env.MONGODB_DB_NAME || "nowgai";

  // Create a connection with timeout for serverless environments
  connectionPromise = (async () => {
    try {
      // Set a timeout for the connection attempt
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("MongoDB connection timeout")), 10000);
      });

      const connectPromise = mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: options.serverSelectionTimeoutMS || 5000,
        socketTimeoutMS: options.socketTimeoutMS || 10000,
        maxPoolSize: options.maxPoolSize || 10,
        minPoolSize: options.minPoolSize || 0,
      });

      await Promise.race([connectPromise, timeoutPromise]);

      isConnected = true;
      console.log(`✅ Connected to MongoDB: ${dbName}`);

      // Handle connection events
      mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected");
        isConnected = false;
        connectionPromise = null;
      });

      mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB connection error:", err);
        isConnected = false;
        connectionPromise = null;
      });

      return mongoose;
    } catch (error) {
      console.error("❌ MongoDB connection error:", error);
      connectionPromise = null;
      isConnected = false;
      throw error;
    }
  })();

  return connectionPromise;
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectFromMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    connectionPromise = null;
    console.log("🔌 Disconnected from MongoDB");
  }
}

/**
 * Check if MongoDB is connected
 */
export function isMongoDBConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get the mongoose connection
 */
export function getMongooseConnection() {
  return mongoose.connection;
}

export { mongoose };

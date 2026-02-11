import mongoose from "mongoose";
import { loadEnvFromDatabase } from "./env.js";

let isConnected = false;
let envLoaded = false; // Track if env has been loaded

export async function connectToDatabase() {
  // Check if connection is actually alive, not just the flag
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  // If connection state indicates it's closed or closing, reset the flag
  if (
    mongoose.connection.readyState === 0 ||
    mongoose.connection.readyState === 3
  ) {
    isConnected = false;
  }

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

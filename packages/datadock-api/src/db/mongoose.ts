import mongoose from 'mongoose';

let isConnected = false;
let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectToMongoDB(): Promise<typeof mongoose> {
  // If already connected, return immediately
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If a connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'datadock';

  // Create a connection with timeout for serverless environments
  connectionPromise = (async () => {
    try {
      // Set a timeout for the connection attempt
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 5000);
      });

      const connectPromise = mongoose.connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        maxPoolSize: 1, // Minimal pool for serverless
        minPoolSize: 0,
      });

      await Promise.race([connectPromise, timeoutPromise]);

      isConnected = true;
      console.log(`✅ Connected to MongoDB: ${dbName}`);
      
      return mongoose;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      connectionPromise = null;
      isConnected = false;
      throw error;
    }
  })();

  return connectionPromise;
}

export async function disconnectFromMongoDB(): Promise<void> {
  if (!isConnected) return;

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

export function getConnectionStatus(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('📡 Mongoose disconnected from MongoDB');
});

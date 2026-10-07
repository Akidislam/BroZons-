import mongoose from 'mongoose';

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      console.warn('[Database Warning] MONGO_URI is not defined in environment variables.');
      return;
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Fail fast if database is unreachable (5 seconds)
    });

    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] Could not connect to MongoDB: ${error.message}`);
    console.warn(
      '[Database Note] To connect to MongoDB, either start your local MongoDB service or set MONGO_URI in your server/.env file (e.g. MongoDB Atlas cluster string).'
    );

    // In production, exit immediately on database connection failure
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

// Monitor connection events
mongoose.connection.on('disconnected', () => {
  console.warn('[Database Event] MongoDB connection lost. Attempting reconnection...');
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database Event] MongoDB connection error: ${err.message}`);
});

export default connectDB;

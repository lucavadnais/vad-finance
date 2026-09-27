import mongoose from 'mongoose';

export async function connectDb(url) {
  if (!url) throw new Error('MONGO_URL is not set');
  await mongoose.connect(url);
  console.log('Connected to MongoDB');
}

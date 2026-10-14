import mongoose from 'mongoose';

export async function connectDb(url) {
  if (!url) throw new Error('MONGO_URL is not set');
  await mongoose.connect(url);
  console.log(`Connected to MongoDB: ${describe(url)}`);
}

function describe(url) {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`;
  } catch {
    return 'unknown address';
  }
}

// Sort names the French way: accents and case do not push "École" after "Zoo"
export const FRENCH = { locale: 'fr' };

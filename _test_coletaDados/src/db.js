const mongoose = require('mongoose');

// Cache global: em serverless a função "esquenta" e reaproveita a conexão.
const cache = global._mongoCache || (global._mongoCache = { conn: null, promise: null });

async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('Defina MONGODB_URI (.env local ou Environment Variables no Vercel)');
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, bufferCommands: false })
      .catch((err) => { cache.promise = null; throw err; });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

module.exports = { connectDB };

import mongoose from "mongoose";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";
import { logger } from "../common/logger.js";

let client: MongoClient | null = null;
export async function connectDatabase(): Promise<Db> {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME, serverSelectionTimeoutMS: 10000 });
  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  logger.info("MongoDB connected");
  return client.db(env.MONGODB_DB_NAME);
}
export const getMongoDb = (): Db => {
  if (!client) throw new Error("MongoDB not connected; call connectDatabase() first");
  return client.db(env.MONGODB_DB_NAME);
};
export const isDbReady = () => mongoose.connection.readyState === 1;
export async function closeDatabase() {
  await mongoose.disconnect().catch(() => undefined);
  await client?.close().catch(() => undefined);
  client = null;
}

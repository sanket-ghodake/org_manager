import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/org_db';

const client = new Client({
  connectionString,
});

// Establish a connection
await client.connect().catch((err: any) => {
  console.warn('Database connection failed, will retry on query execution:', err.message);
});

export const db = drizzle(client, { schema });

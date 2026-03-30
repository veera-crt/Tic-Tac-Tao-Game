import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = 'postgresql://neondb_owner:npg_gQbPY7xm6qoy@ep-flat-haze-amxl4jhd-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS rooms (
      room_id TEXT PRIMARY KEY,
      board JSONB DEFAULT 'null',
      is_x_next BOOLEAN DEFAULT TRUE,
      winner TEXT DEFAULT NULL,
      x_wins INTEGER DEFAULT 0,
      o_wins INTEGER DEFAULT 0,
      ties INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure columns exist for existing tables
  await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS x_wins INTEGER DEFAULT 0;`);
  await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS o_wins INTEGER DEFAULT 0;`);
  await query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS ties INTEGER DEFAULT 0;`);

  await query(`
    CREATE TABLE IF NOT EXISTS players (
      user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id TEXT REFERENCES rooms(room_id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      symbol TEXT NOT NULL,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export default pool;

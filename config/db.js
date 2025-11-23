// db.js
import dotenv from 'dotenv';
import pkg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (adjust path if your .env is in project root)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Log environment variables for debugging
console.log('--- DB ENV VARIABLES ---');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('------------------------');

// Create Pool
export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Function to test DB connection
export const testDBConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log(`✅ Successfully connected to database: ${process.env.DB_DATABASE}`);
  } catch (error) {
    console.error('❌ Failed to connect to the database.');
    console.error(error.stack);
  } finally {
    if (client) client.release();
  }
};

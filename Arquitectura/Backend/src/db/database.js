// Backend/src/db/database.js
const { Pool } = require('pg');
require('dotenv').config();

let pool;

if (process.env.VERCEL) {
  // En Vercel - usar conexión completa
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  // Local - usar variables separadas
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'htas_db',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool
};
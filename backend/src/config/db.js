const pg = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';
let pgPool = null;
let sqliteDb = null;

if (dbType === 'postgres') {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/time_tracker';
  pgPool = new pg.Pool({
    connectionString,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  console.log('Database connected: PostgreSQL');
} else {
  // SQLite setup
  const dbDir = path.join(__dirname, '..', 'db');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'local.db');
  const isNew = !fs.existsSync(dbPath);
  
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
    } else {
      console.log('Database connected: SQLite (local.db)');
      if (isNew) {
        initializeSqliteDb(dbPath);
      }
    }
  });
}

function initializeSqliteDb(dbPath) {
  console.log('Initializing SQLite database schema...');
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  try {
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Adapt schema for SQLite
    schemaSql = schemaSql
      .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/TIMESTAMP WITH TIME ZONE/gi, 'DATETIME')
      .replace(/DECIMAL\(\d+,\s*\d+\)/gi, 'NUMERIC');

    // Run schema commands sequentially
    sqliteDb.exec(schemaSql, (err) => {
      if (err) {
        console.error('Failed to initialize SQLite schema:', err);
      } else {
        console.log('SQLite schema initialized successfully.');
      }
    });
  } catch (error) {
    console.error('Error reading schema file during SQLite initialization:', error);
  }
}

// Custom query wrapper that returns { rows }
async function query(text, params = []) {
  if (dbType === 'postgres') {
    const result = await pgPool.query(text, params);
    return result;
  } else {
    return new Promise((resolve, reject) => {
      // Convert PostgreSQL placeholder $1, $2 to SQLite ?
      const sqliteText = text.replace(/\$\d+/g, '?');
      
      const isSelect = sqliteText.trim().toLowerCase().startsWith('select');
      const isReturning = sqliteText.trim().toLowerCase().includes('returning');
      
      if (isSelect || isReturning) {
        sqliteDb.all(sqliteText, params, (err, rows) => {
          if (err) {
            console.error('SQLite query error:', err, 'SQL:', sqliteText, 'Params:', params);
            return reject(err);
          }
          resolve({ rows });
        });
      } else {
        sqliteDb.run(sqliteText, params, function(err) {
          if (err) {
            console.error('SQLite query error:', err, 'SQL:', sqliteText, 'Params:', params);
            return reject(err);
          }
          resolve({ rows: [], lastId: this.lastID, changes: this.changes });
        });
      }
    });
  }
}

module.exports = {
  query,
  dbType
};

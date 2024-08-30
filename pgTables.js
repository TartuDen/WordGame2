// setupDatabase.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';


dotenv.config();

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'wordgame2',
    password: process.env.DB_PASS,
    port: process.env.DB_PORT || 5432,
});


async function createTables() {
    try {
        await pool.connect();

        // Create the users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                user_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                ava TEXT
            );
        `);

        // Create the user_info table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_info (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                level INTEGER NOT NULL,
                current_xp INTEGER NOT NULL
            );
        `);

        // Create the sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                played_at TIMESTAMP NOT NULL,
                experience_gained INTEGER NOT NULL,
                words_played INTEGER NOT NULL,
                words_guessed_correctly INTEGER NOT NULL,
                time_played INTEGER NOT NULL -- Time in minutes
            );
        `);

        // Create the user_words table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_words (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                word VARCHAR(100) NOT NULL,
                guessed_correctly INTEGER NOT NULL,
                guessed_wrong INTEGER NOT NULL
            );
        `);

        console.log('Tables created successfully');
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        await pool.end();
    }
}

export  {createTables};
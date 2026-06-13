-- Drop tables if they exist (for easy resetting/seeding)
DROP TABLE IF EXISTS time_logs;
DROP TABLE IF EXISTS users;

-- Create Users Table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('employee', 'admin')),
    hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00
);

-- Create TimeLogs Table
CREATE TABLE time_logs (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(10, 4),
    payment_status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid'))
);

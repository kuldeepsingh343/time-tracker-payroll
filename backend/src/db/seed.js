const { query } = require('../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('Starting database seeding...');
  
  try {
    // Clear existing tables
    console.log('Clearing old data...');
    await query('DELETE FROM time_logs');
    await query('DELETE FROM users');
    
    // Hash passwords
    console.log('Hashing passwords...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const johnHash = await bcrypt.hash('john123', 10);
    const janeHash = await bcrypt.hash('jane123', 10);
    
    // Insert Users
    console.log('Inserting default users...');
    
    await query(
      'INSERT INTO users (username, password_hash, role, hourly_rate) VALUES ($1, $2, $3, $4)',
      ['admin1', adminHash, 'admin', 0.00]
    );
    
    await query(
      'INSERT INTO users (username, password_hash, role, hourly_rate) VALUES ($1, $2, $3, $4)',
      ['john_doe', johnHash, 'employee', 25.00]
    );
    
    await query(
      'INSERT INTO users (username, password_hash, role, hourly_rate) VALUES ($1, $2, $3, $4)',
      ['jane_smith', janeHash, 'employee', 30.00]
    );

    console.log('Users inserted successfully.');
    
    // Let's insert a couple of sample logs for history
    const userResult = await query('SELECT user_id, username FROM users WHERE role = $1', ['employee']);
    const employees = userResult.rows;
    
    if (employees.length >= 2) {
      console.log('Inserting sample time logs for demonstration...');
      
      const john = employees.find(e => e.username === 'john_doe');
      const jane = employees.find(e => e.username === 'jane_smith');
      
      const now = new Date();
      
      // John yesterday - 8 hours, paid
      const yesterdayIn = new Date(now);
      yesterdayIn.setDate(now.getDate() - 1);
      yesterdayIn.setHours(9, 0, 0, 0);
      
      const yesterdayOut = new Date(yesterdayIn);
      yesterdayOut.setHours(17, 0, 0, 0); // 8 hours
      
      await query(
        'INSERT INTO time_logs (user_id, clock_in, clock_out, total_hours, payment_status) VALUES ($1, $2, $3, $4, $5)',
        [john.user_id, yesterdayIn.toISOString(), yesterdayOut.toISOString(), 8.0, 'paid']
      );

      // Jane yesterday - 7.5 hours, pending
      const janeIn = new Date(now);
      janeIn.setDate(now.getDate() - 1);
      janeIn.setHours(8, 30, 0, 0);
      
      const janeOut = new Date(janeIn);
      janeOut.setHours(16, 0, 0, 0); // 7.5 hours
      
      await query(
        'INSERT INTO time_logs (user_id, clock_in, clock_out, total_hours, payment_status) VALUES ($1, $2, $3, $4, $5)',
        [jane.user_id, janeIn.toISOString(), janeOut.toISOString(), 7.5, 'pending']
      );
      
      // John today - currently clocked in (no clock_out, total_hours null)
      const todayIn = new Date(now);
      todayIn.setHours(now.getHours() - 3); // clocked in 3 hours ago
      
      await query(
        'INSERT INTO time_logs (user_id, clock_in, clock_out, total_hours, payment_status) VALUES ($1, $2, $3, $4, $5)',
        [john.user_id, todayIn.toISOString(), null, null, 'pending']
      );
      
      console.log('Sample time logs inserted.');
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seed();
}

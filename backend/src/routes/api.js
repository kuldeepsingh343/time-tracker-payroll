const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { verifyToken, verifyAdmin, verifyEmployee, JWT_SECRET } = require('../middleware/auth');

// ==========================================
// 1. AUTHENTICATION (Dashboard Login)
// ==========================================

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const userResult = await query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        hourly_rate: user.hourly_rate
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/auth/me', verifyToken, async (req, res) => {
  try {
    const userResult = await query('SELECT user_id, username, role, hourly_rate FROM users WHERE user_id = $1', [req.user.user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// ==========================================
// 2. KIOSK ENDPOINTS (No token required, uses employee passwords)
// ==========================================

// Get all employees and their active clock status
router.get('/kiosk/employees', async (req, res) => {
  try {
    // Select all employees and verify if they have an active time_log (clock_out IS NULL)
    const sql = `
      SELECT 
        u.user_id, 
        u.username, 
        u.role, 
        u.hourly_rate,
        (SELECT log_id FROM time_logs WHERE user_id = u.user_id AND clock_out IS NULL LIMIT 1) AS active_log_id
      FROM users u
      WHERE u.role = 'employee'
      ORDER BY u.username ASC
    `;
    const result = await query(sql);
    return res.json(result.rows);
  } catch (error) {
    console.error('Kiosk employees fetch error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Clock-In / Clock-Out handler
router.post('/kiosk/clock', async (req, res) => {
  const { userId, password, action } = req.body;
  
  if (!userId || !password || !action || !['clock_in', 'clock_out'].includes(action)) {
    return res.status(400).json({ message: 'Missing or invalid parameters' });
  }

  try {
    // Fetch user
    const userResult = await query('SELECT * FROM users WHERE user_id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const user = userResult.rows[0];
    
    // Verify password securely using bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Process Action
    const now = new Date().toISOString();
    
    // Check active log status
    const activeLogResult = await query(
      'SELECT * FROM time_logs WHERE user_id = $1 AND clock_out IS NULL',
      [userId]
    );
    const activeLog = activeLogResult.rows[0];

    if (action === 'clock_in') {
      if (activeLog) {
        return res.status(400).json({ message: 'User is already clocked in' });
      }
      
      // Create new time log (status defaults to pending)
      await query(
        'INSERT INTO time_logs (user_id, clock_in, clock_out, total_hours, payment_status) VALUES ($1, $2, NULL, NULL, $3)',
        [userId, now, 'pending']
      );
      
      return res.json({ message: `Successfully clocked in at ${new Date(now).toLocaleTimeString()}` });
      
    } else {
      // clock_out action
      if (!activeLog) {
        return res.status(400).json({ message: 'User is not clocked in' });
      }

      // Calculate total hours
      const clockInTime = new Date(activeLog.clock_in);
      const clockOutTime = new Date(now);
      const diffMs = clockOutTime - clockInTime;
      // Convert difference to minutes, then divide by 60 to get hours
      const diffMinutes = diffMs / (1000 * 60);
      const totalHours = Number((diffMinutes / 60).toFixed(4));

      // Update log
      await query(
        'UPDATE time_logs SET clock_out = $1, total_hours = $2 WHERE log_id = $3',
        [now, totalHours, activeLog.log_id]
      );

      return res.json({ 
        message: `Successfully clocked out. Total hours worked: ${totalHours.toFixed(2)} hrs`,
        hours: totalHours
      });
    }

  } catch (error) {
    console.error('Clock operation error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// ==========================================
// 3. EMPLOYEE DASHBOARD ENDPOINTS
// ==========================================

// Fetch history and summary
router.get('/employee/logs', verifyEmployee, async (req, res) => {
  const userId = req.user.user_id;
  const { status } = req.query; // optional: 'pending' or 'paid'

  try {
    // 1. Fetch user hourly rate (in case it changed)
    const userResult = await query('SELECT hourly_rate FROM users WHERE user_id = $1', [userId]);
    const hourlyRate = Number(userResult.rows[0]?.hourly_rate || 0);

    // 2. Fetch logs list
    let logsSql = `
      SELECT log_id, clock_in, clock_out, total_hours, payment_status 
      FROM time_logs 
      WHERE user_id = $1 
    `;
    const params = [userId];

    if (status && ['pending', 'paid'].includes(status)) {
      logsSql += ' AND payment_status = $2 ';
      params.push(status);
    }
    
    logsSql += ' ORDER BY clock_in DESC ';
    
    const logsResult = await query(logsSql, params);
    
    // 3. Fetch summary statistics (all logs for this employee)
    const statsSql = `
      SELECT 
        SUM(CASE WHEN payment_status = 'pending' AND clock_out IS NOT NULL THEN total_hours ELSE 0 END) AS pending_hours,
        SUM(CASE WHEN payment_status = 'paid' THEN total_hours ELSE 0 END) AS paid_hours
      FROM time_logs
      WHERE user_id = $1
    `;
    const statsResult = await query(statsSql, [userId]);
    
    const pendingHours = Number(statsResult.rows[0]?.pending_hours || 0);
    const paidHours = Number(statsResult.rows[0]?.paid_hours || 0);

    return res.json({
      logs: logsResult.rows,
      summary: {
        pending_hours: pendingHours,
        paid_hours: paidHours,
        pending_payout: Number((pendingHours * hourlyRate).toFixed(2)),
        paid_payout: Number((paidHours * hourlyRate).toFixed(2)),
        hourly_rate: hourlyRate
      }
    });

  } catch (error) {
    console.error('Employee logs fetch error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// ==========================================
// 4. ADMIN DASHBOARD ENDPOINTS
// ==========================================

// Get list of all users
router.get('/admin/users', verifyAdmin, async (req, res) => {
  try {
    const result = await query(
      'SELECT user_id, username, role, hourly_rate FROM users ORDER BY role ASC, username ASC'
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Add New User
router.post('/admin/users', verifyAdmin, async (req, res) => {
  const { username, password, role, hourly_rate } = req.body;

  if (!username || !password || !role || hourly_rate === undefined) {
    return res.status(400).json({ message: 'All fields (username, password, role, hourly_rate) are required' });
  }

  if (!['employee', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Role must be employee or admin' });
  }

  const rate = Number(hourly_rate);
  if (isNaN(rate) || rate < 0) {
    return res.status(400).json({ message: 'Hourly rate must be a non-negative number' });
  }

  try {
    // Check if username exists
    const checkUser = await query('SELECT user_id FROM users WHERE username = $1', [username]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    await query(
      'INSERT INTO users (username, password_hash, role, hourly_rate) VALUES ($1, $2, $3, $4)',
      [username, passwordHash, role, rate]
    );

    return res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Admin create user error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove Existing User
router.delete('/admin/users/:id', verifyAdmin, async (req, res) => {
  const deleteId = req.params.id;

  // Prevent admin from deleting themselves
  if (parseInt(deleteId) === req.user.user_id) {
    return res.status(400).json({ message: 'Cannot delete your own admin account' });
  }

  try {
    const checkResult = await query('SELECT user_id FROM users WHERE user_id = $1', [deleteId]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    await query('DELETE FROM users WHERE user_id = $1', [deleteId]);
    return res.json({ message: 'User removed successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Get Payroll Overview and Unreconciled Shifts
router.get('/admin/payroll', verifyAdmin, async (req, res) => {
  try {
    // 1. Calculate each employee's pending payout stats
    // Sum only completed shifts (clock_out IS NOT NULL) that are 'pending' payment
    const employeeSummarySql = `
      SELECT 
        u.user_id,
        u.username,
        u.hourly_rate,
        COALESCE(SUM(CASE WHEN t.payment_status = 'pending' AND t.clock_out IS NOT NULL THEN t.total_hours ELSE 0 END), 0) AS total_pending_hours,
        COALESCE(SUM(CASE WHEN t.payment_status = 'paid' THEN t.total_hours ELSE 0 END), 0) AS total_paid_hours
      FROM users u
      LEFT JOIN time_logs t ON u.user_id = t.user_id
      WHERE u.role = 'employee'
      GROUP BY u.user_id, u.username, u.hourly_rate
      ORDER BY u.username ASC
    `;
    const summaryResult = await query(employeeSummarySql);
    
    const payrollSummary = summaryResult.rows.map(row => {
      const pendingHours = Number(row.total_pending_hours);
      const paidHours = Number(row.total_paid_hours);
      const rate = Number(row.hourly_rate);
      
      return {
        user_id: row.user_id,
        username: row.username,
        hourly_rate: rate,
        pending_hours: pendingHours,
        paid_hours: paidHours,
        pending_payout: Number((pendingHours * rate).toFixed(2)),
        paid_payout: Number((paidHours * rate).toFixed(2))
      };
    });

    // 2. Fetch list of unreconciled shifts (completed & pending)
    const pendingShiftsSql = `
      SELECT 
        t.log_id,
        t.user_id,
        u.username,
        u.hourly_rate,
        t.clock_in,
        t.clock_out,
        t.total_hours,
        t.payment_status
      FROM time_logs t
      JOIN users u ON t.user_id = u.user_id
      WHERE t.payment_status = 'pending' AND t.clock_out IS NOT NULL
      ORDER BY t.clock_in DESC
    `;
    const shiftsResult = await query(pendingShiftsSql);

    return res.json({
      summary: payrollSummary,
      pendingShifts: shiftsResult.rows
    });

  } catch (error) {
    console.error('Admin payroll fetch error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Toggle/Mark specific shift as Paid
router.patch('/admin/shifts/:id/pay', verifyAdmin, async (req, res) => {
  const logId = req.params.id;
  const { payment_status } = req.body; // e.g. 'paid' or 'pending'
  
  if (!payment_status || !['paid', 'pending'].includes(payment_status)) {
    return res.status(400).json({ message: 'payment_status is required and must be either paid or pending' });
  }

  try {
    // Check if log exists
    const checkLog = await query('SELECT log_id FROM time_logs WHERE log_id = $1', [logId]);
    if (checkLog.rows.length === 0) {
      return res.status(404).json({ message: 'Shift log not found' });
    }

    await query(
      'UPDATE time_logs SET payment_status = $1 WHERE log_id = $2',
      [payment_status, logId]
    );

    return res.json({ message: `Shift successfully updated to ${payment_status}` });
  } catch (error) {
    console.error('Admin update shift status error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

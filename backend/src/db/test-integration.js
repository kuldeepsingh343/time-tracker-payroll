const express = require('express');
const cors = require('cors');
const { query } = require('../config/db');
const apiRouter = require('../routes/api');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

let server = app.listen(5002, async () => {
  console.log('Test Server started on port 5002');
  try {
    // 1. Fetch kiosk employees
    console.log('Testing GET /api/kiosk/employees...');
    let res = await fetch('http://localhost:5002/api/kiosk/employees');
    let employees = await res.json();
    console.log(`Employees received: ${employees.length}`);
    if (employees.length === 0) throw new Error('No employees returned');
    
    // Find john_doe (should be clocked in, which is active_log_id not null)
    const john = employees.find(e => e.username === 'john_doe');
    console.log(`John Doe status: ${john.active_log_id ? 'Clocked In' : 'Clocked Out'}`);
    
    // 2. Test Clock-Out for John Doe (since he is clocked in)
    console.log('Testing Clock-Out for john_doe...');
    res = await fetch('http://localhost:5002/api/kiosk/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: john.user_id, password: 'john123', action: 'clock_out' })
    });
    let clockOutRes = await res.json();
    console.log('Clock out response:', clockOutRes);
    if (res.status !== 200) throw new Error(`Clock out failed: ${clockOutRes.message}`);
    
    // 3. Test Admin Login
    console.log('Testing POST /api/auth/login for Admin...');
    res = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin1', password: 'admin123' })
    });
    let loginRes = await res.json();
    console.log('Login response status:', res.status);
    if (res.status !== 200 || !loginRes.token) throw new Error('Admin login failed');
    console.log('Admin login token generated successfully.');
    
    // 4. Test Employee logs (should show the new shift closed)
    console.log('Testing GET /api/employee/logs for John Doe...');
    res = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'john_doe', password: 'john123' })
    });
    let johnLogin = await res.json();
    
    res = await fetch('http://localhost:5002/api/employee/logs', {
      headers: { 'Authorization': `Bearer ${johnLogin.token}` }
    });
    let logsRes = await res.json();
    console.log(`John Doe logs count: ${logsRes.logs.length}`);
    console.log('John Doe summary:', logsRes.summary);
    if (logsRes.logs.length === 0) throw new Error('No logs returned for John Doe');
    
    // 5. Test Admin Payroll Overview
    console.log('Testing GET /api/admin/payroll for Admin...');
    res = await fetch('http://localhost:5002/api/admin/payroll', {
      headers: { 'Authorization': `Bearer ${loginRes.token}` }
    });
    let payrollRes = await res.json();
    console.log('Admin payroll summary employees:', payrollRes.summary.length);
    console.log('Admin pending shifts:', payrollRes.pendingShifts.length);
    if (res.status !== 200) throw new Error('Failed to fetch admin payroll');

    console.log('\n=============================================');
    console.log(' INTEGRATION TESTS PASSED SUCCESSFULLY! ✅');
    console.log('=============================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ INTEGRATION TEST FAILED:', error);
    process.exit(1);
  } finally {
    server.close();
  }
});

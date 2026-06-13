# Chronos Time-Tracking & Payroll Web Application

A secure, responsive full-stack web application designed for shared kiosk operations (ideal for iPad/tablet terminals), individual employee timesheets, and administrator payroll controls.

## 🚀 Features

- **Shared Kiosk Terminal:** A grid roster showing all employee profiles. Quick buttons allow employees to Clock In or Clock Out. Actions are secured via individual passwords and verified using bcrypt hashing on the backend.
- **Passcode Touch-Pad:** An on-screen keypad optimized for touchscreen tablets (like iPads) alongside traditional keyboard input.
- **Private Employee Dashboard:** Secure employee login showing accumulated pending and paid work hours/earnings with interactive timesheet history filtering.
- **Admin Command Board:** 
  - *Payroll Reconciliation:* Overview of total unpaid payouts. Tabular review of unpaid completed shifts with instantaneous status-updating buttons.
  - *User Management:* CRUD forms for adding new staff profiles (role, hourly rates) and removing profiles.

---

## 📁 Project Structure

```text
time-tracker-payroll/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js          # Unified SQLite & PostgreSQL adapter
│   │   ├── db/
│   │   │   ├── schema.sql     # Relational DB Schema
│   │   │   └── seed.js        # Hashed password user seeder
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT protection middleware
│   │   ├── routes/
│   │   │   └── api.js         # API Route controllers
│   │   └── index.js           # Express server entry point
│   ├── .env                   # Environment config (defaults to SQLite)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Kiosk, Login, Employee & Admin view panels
│   │   ├── context/
│   │   │   └── AuthContext.jsx# React Context for session management
│   │   ├── App.css            # Unused default styles (cleared)
│   │   ├── App.jsx            # Main app shell & React Router routes
│   │   ├── index.css          # Custom visual styling & responsive design tokens
│   │   └── main.jsx           # Vite entrypoint
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml         # Containerized PostgreSQL service
└── README.md                  # Setup & Usage Documentation
```

---

## 🛠️ Setup Instructions

### 1. Prerequisite
Ensure you have **Node.js** (v16+) installed. Optionally, **Docker** is recommended if you wish to run PostgreSQL.

### 2. Database Modes
The application supports **SQLite (Default - Zero Configuration)** and **PostgreSQL (Production-Ready)**.

#### Option A: SQLite (Immediate running - Recommended for testing)
No installation is required. The backend automatically initializes and seeds a local database file at `backend/src/db/local.db`.

#### Option B: PostgreSQL
1. Start the PostgreSQL container from the root directory:
   ```bash
   docker-compose up -d
   ```
2. Update the environment configuration in `backend/.env`:
   ```env
   DB_TYPE=postgres
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/time_tracker
   ```
3. Run the schema seeder manually to create the tables in PostgreSQL:
   ```bash
   npm --prefix backend run seed
   ```

---

## 🏃 Running the Application

### Step 1: Run the Backend Server
Start the Express server on port `5001`:
```bash
npm --prefix backend run dev
```

### Step 2: Run the Frontend App
Start the Vite development server on port `5173`:
```bash
npm --prefix frontend run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🔑 Test Credentials (Seeded Automatically)

| Account Role | Username | Password/PIN | Hourly Rate |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin1` | `admin123` | *N/A* |
| **Employee** | `john_doe` | `john123` | `$25.00` |
| **Employee** | `jane_smith` | `jane123` | `$30.00` |

---

## 🔄 Verification Scenarios

1. **Verify Clocking-In:**
   - On the Kiosk view, click **Clock-In** under `jane_smith`.
   - Enter password `jane123`.
   - Verify that her card updates to "Clocked In" and a success toast appears.
2. **Verify Clocking-Out & Calculations:**
   - Since `john_doe` is clocked in, click **Clock-Out** under his name.
   - Enter password `john123`.
   - Verify that he is clocked out and a success toast displays his total hours (calculated as `(ClockOut - ClockIn) / 60 minutes`).
3. **Verify Employee Dashboard:**
   - Go to **Sign In** (top right) and log in with `john_doe` / `john123`.
   - View your hours breakdown (Pending vs Paid) and logs. Toggle filters.
4. **Verify Admin Dashboard:**
   - Log out and sign in with `admin1` / `admin123`.
   - Go to **Admin Board**. Check the outstanding payouts under **Payroll**.
   - Check the **Unpaid completed shifts** list. Click **Mark Paid** next to a shift.
   - Observe that the shift disappears, and the employee's payroll balance updates instantly.
5. **Verify User Management:**
   - On the **User Roster Manager** tab, create a new employee `bob_builder` with rate `22.50`.
   - Check the Kiosk Mode roster -> `bob_builder` is instantly visible.
   - In the Admin panel, delete `bob_builder` -> he is removed immediately.

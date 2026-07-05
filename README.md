<p align="center">
  <img src="./docs/samaya-logo.png" alt="Samaya Logo" width="200"/>
</p>

<h1 align="center">Samaya</h1>
<p align="center"><strong>Precision Time & Attendance</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs" />
  <img src="https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-003B57?style=flat-square&logo=sqlite" />
  <img src="https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" />
</p>

---

**Samaya** is a secure, full-stack **Time & Attendance** web application built for teams. It features a shared **Kiosk terminal** (perfect for tablets/iPads), private **Employee dashboards**, and a powerful **Admin control board** — including manual time correction and payroll reconciliation.

---

## ✨ Features

### 🖥️ Shared Kiosk Mode
- Live grid of all employees showing **Clocked In / Clocked Out** status
- One-tap Clock In / Clock Out with a secure **PIN pad** (touchscreen optimised)
- Password verified on the server with **bcrypt** — never sent in plain text

### 👤 Employee Dashboard
- View personal **pending and paid** hours & earnings
- Full timesheet history with **date range filtering** (Today / Week / Month / All)
- Real-time running clock while currently clocked in

### 🛡️ Admin Command Board
Three dedicated tabs for administrators:

| Tab | Capability |
|:----|:-----------|
| **Payroll & Reconciliation** | View outstanding payouts per employee, mark shifts as paid, edit shift timestamps |
| **✏️ Time Corrections** | Create manual shift entries for employees who forgot to clock in; edit any pending shift's clock-in/out times |
| **User Roster Manager** | Add new employees or admins (with role & hourly rate), delete accounts |

### 🔐 Security
- JWT-based session management (stored in localStorage)
- All admin routes protected server-side by role verification middleware
- Passwords hashed with **bcrypt** (saltRounds = 10)

---

## 🗂️ Project Structure

```
samaya/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js           # Unified SQLite & PostgreSQL adapter
│   │   ├── db/
│   │   │   ├── schema.sql      # Relational DB schema
│   │   │   └── seed.js         # Demo user seeder (hashed passwords)
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT auth & role-guard middleware
│   │   ├── routes/
│   │   │   └── api.js          # All REST API endpoints
│   │   └── index.js            # Express server entry point
│   ├── .env                    # Local environment config
│   ├── .env.example            # Environment variable template
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── samaya-logo.png     # App logo (favicon + navbar + login)
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── EmployeeDashboard.jsx
│   │   │   ├── KioskView.jsx
│   │   │   ├── LoginView.jsx
│   │   │   └── Navbar.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx # React Context + API fetch wrapper
│   │   ├── App.jsx             # App shell & React Router routes
│   │   ├── index.css           # Design system & component styles
│   │   └── main.jsx            # Vite entry point
│   ├── .env.example            # Frontend env variable template
│   └── vite.config.js
├── docs/
│   └── samaya-logo.png
├── docker-compose.yml          # Optional PostgreSQL container
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js** v16 or higher
- npm v8 or higher

### 1. Clone the repository

```bash
git clone https://github.com/kuldeepsingh343/time-tracker-payroll.git
cd time-tracker-payroll
```

### 2. Install dependencies

```bash
# Install backend dependencies
npm --prefix backend install

# Install frontend dependencies
npm --prefix frontend install
```

### 3. Configure the backend

The backend defaults to **SQLite** (zero configuration — no database setup needed):

```bash
# backend/.env is pre-configured for SQLite
# No changes needed for local development
```

> To use **PostgreSQL** instead, edit `backend/.env`:
> ```env
> DB_TYPE=postgres
> DATABASE_URL=postgresql://user:password@localhost:5432/samaya
> ```

### 4. Seed demo accounts

```bash
npm --prefix backend run seed
```

### 5. Run the servers

Open **two terminal windows**:

```bash
# Terminal 1 — Backend API (port 5001)
npm --prefix backend run dev

# Terminal 2 — Frontend (port 5173)
npm --prefix frontend run dev
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser. ✅

---

## 🔑 Demo Accounts

> These are created automatically when you run `npm --prefix backend run seed`.

| Role | Username | Password | Hourly Rate |
|:-----|:---------|:---------|:------------|
| Administrator | `admin1` | `admin123` | — |
| Employee | `john_doe` | `john123` | $25.00/hr |
| Employee | `jane_smith` | `jane123` | $30.00/hr |

---

## 🌐 Production Deployment (Free Hosting)

The recommended free stack is:

```
Browser → Vercel (Frontend) → Render (Backend) → Supabase (PostgreSQL)
```

### Step 1 — Database: Supabase

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project and save your password
3. Go to **Settings → Database → Connection String (URI)** and copy it
4. Open **SQL Editor**, paste `backend/src/db/schema.sql`, and run it
5. Then run the contents of `backend/src/db/seed.js` as raw SQL to seed users

### Step 2 — Backend: Render

1. Sign up at [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repo, set **Root Directory** to `backend`
3. Set **Build Command** → `npm install`, **Start Command** → `npm start`
4. Add Environment Variables:

   | Key | Value |
   |:----|:------|
   | `DB_TYPE` | `postgres` |
   | `DATABASE_URL` | *(Supabase connection URI)* |
   | `JWT_SECRET` | *(any long random string)* |
   | `PORT` | `5001` |

5. Deploy — copy your Render URL (e.g. `https://samaya-api.onrender.com`)

### Step 3 — Frontend: Vercel

1. Sign up at [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo, set **Root Directory** to `frontend`
3. Add Environment Variable:

   | Key | Value |
   |:----|:------|
   | `VITE_API_URL` | `https://samaya-api.onrender.com/api` |

4. Deploy — your app is now live! 🎉

> **Note:** Render's free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30s. Upgrade to the $7/month plan for always-on service.

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/auth/login` | Login, returns JWT |
| `GET` | `/api/auth/me` | Get current user from token |

### Kiosk (Public)
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/kiosk/employees` | Get all employees with clock status |
| `POST` | `/api/kiosk/clock` | Clock in/out (password verified) |

### Employee (JWT Required)
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/employee/dashboard` | Personal stats & timesheet logs |

### Admin (JWT + Admin Role Required)
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/admin/payroll` | All pending shifts & payroll summary |
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Create a new user |
| `DELETE` | `/api/admin/users/:id` | Remove a user |
| `PATCH` | `/api/admin/shifts/:id/pay` | Mark a shift as paid |
| `POST` | `/api/admin/logs` | **Create manual shift entry** |
| `PATCH` | `/api/admin/logs/:id` | **Edit shift clock-in/out times** |

---

## 🛠️ Tech Stack

| Layer | Technology |
|:------|:-----------|
| Frontend | React 18 + Vite, React Router v6, Vanilla CSS |
| Backend | Node.js, Express.js |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| ORM/Query | Raw SQL with unified db adapter |
| Hosting | Vercel (frontend), Render (backend), Supabase (DB) |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<p align="center">Built with ❤️ — Samaya &copy; 2025</p>

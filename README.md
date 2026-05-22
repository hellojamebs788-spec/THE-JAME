# FinFlow — Personal Finance & Debt Tracker

A beautiful, fully-functional personal finance tracker for salary earners. Tracks daily spending budgets, debts, and savings goals with a Supabase backend. Deploy instantly on GitHub Pages.

---

## ✨ Features

- **Daily Budget Calculator** — Auto-computes your daily spending allowance based on salary, fixed costs, savings targets, and debt payments
- **Real-time Spending Tracker** — Shows today's spend vs. budget with a visual progress bar
- **Debt Dashboard** — Tracks balances, interest rates, monthly payments, and estimated months to debt-free
- **Savings Goals** — Visual progress toward each savings target
- **OCR Slip Upload** — Upload a bank transfer slip; simulated OCR parses it into a transaction (real API hookup ready)
- **Demo Mode** — Fully usable offline with localStorage (no Supabase needed to try it out)
- **Mobile Responsive** — Works on phone, tablet, and desktop

---

## 🚀 Quick Start

### 1. Clone or Download

```bash
git clone https://github.com/yourusername/finflow.git
cd finflow
```

Open `index.html` directly in a browser — it works immediately in **demo mode** (data stored in localStorage).

---

### 2. Set Up Supabase (for persistent cloud data)

#### A. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, choose a name and password
3. Wait for the project to spin up (~1 min)

#### B. Run the SQL Setup Script
1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `supabase_setup.sql`
4. Click **Run**

This creates the three tables and sets up Row Level Security (RLS) so the app can read/write without authentication errors.

#### C. Get Your Credentials
1. Go to **Settings → API** in your Supabase dashboard
2. Copy:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (long JWT string)

#### D. Connect the App
1. Open FinFlow in your browser
2. Click the **⚙ Settings** button in the bottom-left sidebar
3. Paste your **Supabase URL** and **Anon Key**
4. Set your monthly salary, fixed costs, and savings target
5. Click **Save & Reconnect**

The connection dot in the top-right will turn **green** when connected.

---

### 3. Deploy to GitHub Pages

1. Push the project folder to a GitHub repository
2. Go to **Settings → Pages** in your repo
3. Set source to **Deploy from branch → main → / (root)**
4. Your app will be live at `https://yourusername.github.io/finflow`

> **Note:** All Supabase credentials are stored in the browser's `localStorage`, so they stay on your device and are never committed to the repo.

---

## 🗄️ Database Schema

| Table | Key Columns |
|-------|-------------|
| `transactions` | `id`, `date`, `description`, `category`, `type` (income/expense), `amount` |
| `debts` | `id`, `name`, `remaining_balance`, `interest_rate`, `monthly_payment` |
| `savings` | `id`, `goal_name`, `current_amount`, `target_amount` |

---

## 🔌 Integrating a Real OCR API

The `simulateOCR()` function in `script.js` is the integration point. Look for the large comment block inside it (around line 340) with instructions for:

- **Google Cloud Vision** — Best for Thai bank slips
- **AWS Textract** — Enterprise grade, good for scanned documents  
- **Mindee** — Specialist in bank statements and receipts

---

## 🔒 Security Notes

- The app uses the **anon** Supabase key (safe for client-side use)
- RLS policies allow full public access — suitable for a personal single-user app
- For multi-user use, enable Supabase Auth and restrict policies with `auth.uid()`
- Never commit your Supabase keys to a public repo (the Settings UI stores them in localStorage only)

---

## 📁 File Structure

```
finflow/
├── index.html          # App shell, all sections and modals
├── style.css           # Full design system & responsive layout
├── script.js           # App logic, Supabase client, OCR simulation
├── supabase_setup.sql  # Database schema + RLS setup
└── README.md           # This file
```

---

## 🛠️ Customisation

| What | Where |
|------|-------|
| Currency symbol | Settings modal → Currency Symbol |
| Monthly salary / fixed costs | Settings modal |
| Transaction categories | `txCategory` select in `index.html` |
| Category emoji icons | `CATEGORY_ICONS` object in `script.js` |
| Color theme | CSS variables at top of `style.css` |

---

## License

MIT — use freely, no attribution required.

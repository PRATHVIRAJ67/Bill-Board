# 🚀 Cloudflare Deployment Guide (Pages + Workers)

Deploy **The Board** to Cloudflare to achieve ultra-fast global performance and infinite scaling at zero fixed cost.

---

## Architecture Overview
- **Backend**: [Cloudflare Worker](file:///c:/Users/prathviraj/Desktop/Bill-Board/backend/worker.js) running Hono + Supabase + Razorpay API.
- **Frontend**: [Cloudflare Pages](file:///c:/Users/prathviraj/Desktop/Bill-Board/frontend) hosting the React 3D Billboard app.
- **Database**: [Supabase PostgreSQL](https://supabase.com) with Row Level Security & real-time sync.

---

## 1. Deploy the Backend (Cloudflare Worker)

### Step 1.1: Authenticate with Cloudflare
Open your terminal in the `backend/` directory:
```bash
cd backend
npx wrangler login
```
*(Follow the browser prompt to log into your Cloudflare account and authorize Wrangler)*

### Step 1.2: Deploy the Worker
Run:
```bash
npx wrangler deploy
```
Once deployed, Wrangler will output your live worker URL, for example:
`https://billboard-api.<your-subdomain>.workers.dev`

### Step 1.3: Set Environment Secrets (Optional / Recommended)
Set your secret keys securely in Cloudflare:
```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put RAZORPAY_KEY_SECRET
```

---

## 2. Deploy the Frontend (Cloudflare Pages)

### Option A: Deploy Directly via CLI (Fastest)

1. Build the production React app:
```bash
cd frontend
npm run build
```

2. Deploy the `build` folder to Cloudflare Pages:
```bash
npx wrangler pages deploy build --project-name billboard-frontend
```
*(On first run, Wrangler will ask if you want to create a new project `billboard-frontend` — select Yes).*

3. Set your live Backend Worker URL:
In the Cloudflare Dashboard -> **Workers & Pages** -> **billboard-frontend** -> **Settings** -> **Environment variables**:
- Variable name: `REACT_APP_BACKEND_URL`
- Value: `https://billboard-api.<your-subdomain>.workers.dev`

---

### Option B: Deploy via GitHub Continuous Deployment (Recommended for Auto-Deploys)

1. Push your code to GitHub:
```bash
git add .
git commit -m "Configure Cloudflare Worker and Pages deployment"
git push origin main
```

2. In Cloudflare Dashboard:
- Go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**
- Select repository: `PRATHVIRAJ67/Bill-Board`
- Build settings:
  - **Framework preset**: `Create React App`
  - **Root directory**: `frontend`
  - **Build command**: `npm run build`
  - **Build output directory**: `build`
- Under **Environment variables**, add:
  - `REACT_APP_BACKEND_URL`: `https://billboard-api.<your-subdomain>.workers.dev`
  - `REACT_APP_SUPABASE_URL`: `https://nyfyofcjnphwhxciaqox.supabase.co`
  - `REACT_APP_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Click **Save and Deploy**.

---

## 3. Verify Live Setup
1. Open your live Cloudflare Pages URL (e.g. `https://billboard-frontend.pages.dev`).
2. Test spot claiming and live 3D board updates.
3. Check worker analytics and health at `https://billboard-api.<your-subdomain>.workers.dev/api`.

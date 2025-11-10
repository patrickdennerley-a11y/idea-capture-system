# 🚀 Backend Setup - Quick Start Guide

## ✅ Status Check

Your backend is **READY TO GO!** Everything is set up correctly:
- ✅ `server.cjs` exists with all API endpoints
- ✅ `package.json` has the "server" script
- ✅ All dependencies are installed
- ✅ Frontend is configured to call the right endpoints

**You just need to add your API key!**

---

## 📋 Step-by-Step Setup (5 minutes)

### **Step 1: Create .env file**

```bash
cp .env.example .env
```

### **Step 2: Add your Anthropic API key**

Open the `.env` file and replace `your_api_key_here` with your actual API key:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
PORT=3001
NODE_ENV=development
```

**Get your API key here:** https://console.anthropic.com/settings/keys

### **Step 3: Verify dependencies are installed**

```bash
npm install
```

This should be instant since everything is already installed.

---

## 🎬 Running the App

Open **TWO separate terminals**:

### Terminal 1: Start Backend

```bash
npm run server
```

You should see:
```
╔════════════════════════════════════════════════╗
║   Neural Capture API Server                   ║
║   Running on http://localhost:3001            ║
║   ...                                          ║
╚════════════════════════════════════════════════╝
```

### Terminal 2: Start Frontend

```bash
npm run dev
```

You should see:
```
  VITE ready in XXX ms
  ➜  Local:   http://localhost:3000/
```

---

## 🧪 Testing It Works

1. Open http://localhost:3000 in your browser
2. Go to the **Capture** tab
3. Add a few test ideas:
   - "Build a mobile app for task tracking"
   - "Research AI automation tools"
   - "Study React advanced patterns"
4. Click the **"AI Organize Ideas"** button
5. Wait 2-5 seconds (button will show "Organizing with AI...")
6. You should see a beautiful modal with your ideas organized by theme!

---

## 🔧 API Endpoints (Backend)

Your server has these endpoints ready:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check - test if server is running |
| POST | `/api/organize-ideas` | Send ideas, get AI organization |
| POST | `/api/weekly-summary` | Get weekly summary (future feature) |
| POST | `/api/analyze-patterns` | Analyze energy/idea patterns (future feature) |

---

## 🐛 Troubleshooting

### ❌ "Cannot GET /" when visiting http://localhost:3001

**This is NORMAL!** The server has no homepage. Check if it's working by:

```bash
curl http://localhost:3001/health
```

Should return:
```json
{"status":"healthy","timestamp":"...","service":"Neural Capture API"}
```

### ❌ Getting 404 errors on "AI Organize Ideas"

**Check these:**

1. Is the backend running? Look for the startup message in Terminal 1
2. Is it running on port 3001? Check the startup message
3. Is the frontend using the Vite proxy? (This is already configured)

**Quick test:**

```bash
# Test the endpoint directly
curl -X POST http://localhost:3001/api/organize-ideas \
  -H "Content-Type: application/json" \
  -d '{"ideas":[{"content":"test idea","tags":[],"timestamp":"2024-01-01"}]}'
```

If this works, the backend is fine. If not, check your .env file.

### ❌ "Invalid API key" error

Your API key in `.env` is wrong. Double-check:
1. The key starts with `sk-ant-api03-`
2. No extra spaces or quotes around it
3. The file is named `.env` (not `.env.txt`)

### ❌ Backend won't start / Port 3001 in use

Something else is using port 3001. Kill it:

```bash
# Find what's using port 3001
lsof -i :3001

# Kill it (replace PID with the actual process ID)
kill -9 PID
```

Or change the port in `.env`:
```env
PORT=3002
```

---

## 🎯 Quick Test Commands

```bash
# Check if backend is healthy
curl http://localhost:3001/health

# Check if frontend is running
curl http://localhost:3000

# Test the organize endpoint (requires API key)
curl -X POST http://localhost:3001/api/organize-ideas \
  -H "Content-Type: application/json" \
  -d '{"ideas":[{"content":"Build an app","tags":["business"],"timestamp":"2024-01-01T10:00:00Z"}]}'
```

---

## ✨ That's It!

Once both servers are running, the **AI Organize Ideas** button should work perfectly. Claude will analyze your captured ideas and organize them by theme with priority levels!

**Need help?** The backend logs show all incoming requests, so check Terminal 1 for any errors.

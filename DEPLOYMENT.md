# 🚀 EnthutechIoT — Production Deployment Guide

## Architecture Overview

```text
┌─────────────────────┐     WebSocket / HTTP/S      ┌─────────────────────┐
│   React Frontend    │ ←─────────────────────────→ │   Node.js Backend   │
│   (Served by Node)  │                             │   Render Docker env │
│                     │                             │   + Firebase        │
└─────────────────────┘                             └─────────────────────┘
                                                              ↑
                                                     WebSocket / HTTP POST
                                                              │
                                                    ┌────────────────────┐
                                                    │ ESP32 Devices      │
                                                    │ (WiFi+any proto)   │
                                                    └────────────────────┘
```

---

## Step 1 — Verify Firebase / MongoDB Configuration

If you are using Firebase (as configured in `server.cjs`), ensure you have your Firebase keys handy. You'll need to provide these to Render securely.

---

## Step 2 — Deploy to Render (All-in-One Frontend + Backend)

We have configured a `Dockerfile` and `render.yaml` to make deploying to [Render](https://render.com) extremely simple. 
Because the server dynamically compiles ESP32 code using `arduino-cli`, the Docker container automatically installs all required build tools for you!

### Using Render Blueprint (1-Click Setup)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository containing this code.
4. Render will detect the `render.yaml` file automatically.
5. Provide the required Environment Variables in the Render UI (e.g., your `VITE_FIREBASE_*` keys) during the review step.
6. Click **Apply**.

Render will now build your Docker container. This process installs Node.js, Arduino CLI, the ESP32 core, and automatically builds your React frontend!

> **Note**: Your React frontend will be automatically accessible at the root URL provided by Render (e.g., `https://your-app-name.onrender.com`). No need to host it separately on Vercel unless desired.

---

## Step 3 — Testing Your Server

1. Once the Render deployment is live, go to your new public URL:
   ```
   https://enthutech-iot.onrender.com/health
   ```
   It should return: `{"status":"ok", "db":"connected", ...}`

2. Open the base URL `https://enthutech-iot.onrender.com` in your browser. You should see your React dashboard load.

---

## HTTP vs HTTPS vs WebSocket — How each protocol works

### WebSocket (best — real-time)
- ESP32 stays connected persistently.
- Uplink: ESP32 sends `{type:"data", data:{...}}`
- Downlink: Server pushes `{type:"command", key, value}` instantly.
- No polling needed.

### HTTP (simple — sensor-only devices)
- Uplink: `POST /api/v1/devices/:id/ingest` every N seconds
- Downlink: `GET /api/v1/devices/:id/commands` every 3 seconds
  - Server queues commands in MongoDB
  - ESP32 picks them up on next poll, ACKs them

### HTTPS (encrypted)
- Same endpoints — just use `WiFiClientSecure` on ESP32
- **Required** when backend is on Render (URLs are always HTTPS)
- Uplink + downlink work exactly the same way

---

## ESP32 — Updating the Server URL

In the generated Arduino sketch, update your server settings:
```cpp
// Change this to your Render app hostname:
const char* SERVER = "your-app-name.onrender.com";
const int   PORT   = 443;               // HTTPS on Render
```

---

## Local Development (Quick Start)

```bash
# Terminal 1 — Backend
npm run server

# Terminal 2 — Frontend
npm run dev
```
*(Optionally use `.env` to configure your local keys!)*

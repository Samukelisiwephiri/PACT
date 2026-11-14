# PACT - Peer-to-Peer Agreement & Community Trust

**Hackathon Track:** Mobile Money & Peer-to-Peer / Merchant & Machine Payments
**Team:** Hack2go

## Project Structure
```
pact_stokvel_app/
├── contracts/        # Solidity Smart Contracts (PACT.sol)
├── firmware/         # ESP32 C++ Microcontroller Firmware (main.cpp)
├── backend/          # Node.js/Express Web3 Relay Server
└── frontend/         # React / Vite Web Dashboard & Simulator
```

## Quick Start (VS Code)
1. Open this directory in **VS Code**.
2. Install the frontend and backend workspace dependencies:
   ```bash
   npm install
   ```
3. Copy `backend/.env.example` to `backend/.env`, then start the whole app from this directory:
   ```bash
   npm run dev
   ```
   Open `http://localhost:8080`. The development runner starts Vite and Express together,
   and Vite proxies `/api` requests to the backend on port 5000. For a single production
   server, run `npm start`; it builds the frontend and serves it with the Express API.
   Email accounts are stored in `backend/data/users.json` with scrypt-hashed passwords.
   To enable Google sign-in, create a Google OAuth web client, add `http://localhost:5173`
   as an authorized JavaScript origin, then set the same client ID as `GOOGLE_CLIENT_ID`
   in `backend/.env` and `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`. Restart both servers
   after changing environment variables. In production, set `FRONTEND_URL` to the exact
   public app origin and serve the app over HTTPS.
   To enable PayFast contributions, add your PayFast **sandbox** merchant ID and key to
   `PAYFAST_MERCHANT_ID` and `PAYFAST_MERCHANT_KEY` in `backend/.env`, then leave
   `PAYFAST_SANDBOX=true`. Set `PAYFAST_PASSPHRASE` if one is configured on the merchant
   account. The amount is set server-side with `PACT_CONTRIBUTION_AMOUNT_ZAR` (defaults
   to `2500.00`); the browser cannot change the charged amount. PayFast only marks a
   contribution paid after its signed ITN is validated. For local testing, expose the
   backend through an HTTPS tunnel and set `PAYFAST_NOTIFY_BASE_URL` to that public API
   origin so PayFast can reach `/api/payments/notify`. For live payments, use production
   merchant credentials, set `PAYFAST_SANDBOX=false`, and configure HTTPS public URLs.
   Checkout uses PayFast's hosted page; the app never handles card details. A confirmed
   PayFast payment is recorded off-chain and does not automatically transfer money into
   the smart-contract pool.
4. **Smart Contracts**: Deploy `contracts/PACT.sol` using Remix IDE or Hardhat to Sepolia testnet.
5. **Hardware**: Flash `firmware/main.cpp` using PlatformIO plugin in VS Code.

The JSON account and payment stores are suitable for local development only. Before
deploying authentication or payment processing to Vercel or another serverless host,
replace them with a shared persistent database; serverless filesystem and in-memory
sessions are not durable across function instances.

## Deploy to Vercel

Import the repository into Vercel and set **Root Directory** to the directory
containing this `package.json` and `vercel.json` (use `.` if these files are at
the repository root). The included `vercel.json` installs both workspaces and
builds the Vite frontend into `frontend/dist`. Vercel serves that directory as
the website, while `api/[...path].js` sends `/api/*` requests to the existing
Express backend. The frontend and API therefore share the same origin, and the
frontend does not need `VITE_API_URL` set.

In Vercel **Project Settings > Environment Variables**, set `FRONTEND_URL` to
your public HTTPS app origin (for example, your production `*.vercel.app` URL
or custom domain). If unset, the app uses Vercel's deployment URL. For Google
sign-in, set both `GOOGLE_CLIENT_ID` and the build-time `VITE_GOOGLE_CLIENT_ID`.
For PayFast, set the merchant credentials and `PAYFAST_NOTIFY_BASE_URL` to the
same public HTTPS origin. Never commit these values or private keys. After
adding or changing build-time variables, redeploy so Vite can include them.

**Important:** signup, sessions, and payment orders currently use local JSON files
and in-memory sessions. Vercel functions do not provide durable writable storage or
shared memory, so those features require a persistent database/session store before
they can be relied on in a deployed app. The frontend and API can deploy together,
but this storage limitation must be addressed for production authentication/payments.

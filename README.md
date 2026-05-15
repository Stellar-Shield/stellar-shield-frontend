# 🛡️ StellarShield — Frontend

> **A programmable security layer for your Stellar wallet.**  
> Don't just hold crypto — control it.  
> Part of the three-repo StellarShield system: `contract → backend → frontend`.

StellarShield wraps your Stellar wallet in a set of on-chain guard rules: daily velocity limits, passkey-based biometric auth, and a whitelist of trusted payment streams (Drips). This repo is the Next.js 15 dashboard that ties it all together.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐  │
│   │ VelocityGauge│   │   DripList   │   │   AuthModal   │  │
│   └──────┬───────┘   └──────┬───────┘   └──────┬────────┘  │
│          │                  │                  │            │
│          └──────────────────┼──────────────────┘            │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Next.js 15 App │                      │
│                    │  /dashboard     │                      │
│                    └────────┬────────┘                      │
└─────────────────────────────┼───────────────────────────────┘
                              │
              ┌───────────────▼───────────────┐
              │  Next.js API Route (server)    │
              │  /api/backend/[...path]        │  ← BACKEND_URL never
              │  catch-all proxy               │    reaches the browser
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │   stellar-shield-backend       │
              │   Express API                  │
              │   • WebAuthn challenge/verify  │
              │   • Contract event indexer     │
              │   • Transaction relay          │
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │   Soroban RPC (testnet)        │
              │   soroban-testnet.stellar.org  │
              └───────────────┬───────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐   ┌──────────▼──────┐   ┌─────────▼───────┐
│ GuardContract│   │RegistryContract │   │  AuthContract   │
│ velocity cap │   │ drip whitelist  │   │ P-256 passkeys  │
└──────────────┘   └─────────────────┘   └─────────────────┘
```

### Data flow for a transfer

```
User enters amount
      │
      ▼
useWallet.sign(xdr)          ← Freighter signs the transaction
      │
      ▼
POST /api/backend/tx/relay   ← Next.js proxy forwards to backend
      │
      ▼
backend → Soroban RPC        ← submits signed XDR to network
      │
      ▼
GuardContract::execute_transfer
  ├─ is_trusted_drip(to)?  → yes → skip velocity check, transfer
  └─ no → check spent + amount ≤ limit → update spent → transfer
```

### WebAuthn signature flow

```
Browser                     Backend                  Contract
  │                            │                        │
  │── GET /auth/challenge ────▶│                        │
  │◀─ { challenge, sessionId }─│                        │
  │                            │                        │
  │  navigator.credentials     │                        │
  │  .get({ challenge })       │                        │
  │  [authenticator signs]     │                        │
  │                            │                        │
  │── POST /auth/verify ──────▶│                        │
  │   { sessionId, assertion } │                        │
  │                            │ DER → compact r‖s      │
  │◀─ { compactSig, message } ─│                        │
  │                            │                        │
  │── verify_sig(user,         │                        │
  │     message, compactSig) ──┼───────────────────────▶│
  │                            │              bool ◀────│
```

---

## ✨ Key Features

### Velocity Gauge
An SVG radial chart showing how much of your daily XLM limit you've spent. Colour shifts green → amber → red as you approach the cap.

```tsx
// src/components/VelocityGauge.tsx
<VelocityGauge
  spentXlm={velocity.spentXlm}
  limitXlm={velocity.limitXlm}
  pctUsed={velocity.pctUsed}   // 0–100, drives the SVG dashoffset
/>
```

The underlying hook polls the backend every time you call `refresh()`:

```ts
// src/hooks/useVelocity.ts
const { limitXlm, spentXlm, remainingXlm, pctUsed, refresh } = useVelocity(publicKey);
```

### Biometric Passkey Auth
Uses `Navigator.credentials` (WebAuthn / FIDO2) to link your device to `AuthContract`. Registration extracts the raw 65-byte uncompressed P-256 public key from the SPKI response:

```ts
// src/hooks/usePasskey.ts
const { register, assert } = usePasskey(userId);

// Register — returns 65-byte SEC1 pubkey for AuthContract::register_key
const pubkey: Uint8Array = await register();

// Assert — returns compact r||s sig ready for AuthContract::verify_sig
const { compactSig, message } = await assert();
```

The DER → compact conversion happens **in the backend**, never in the browser:

```ts
// stellar-shield-backend/src/lib/webauthn.ts
export function derToCompact(der: Buffer): Buffer {
  // strips DER framing, pads r and s to 32 bytes each
  // returns r || s (64 bytes) for AuthContract::verify_sig
}
```

### Drip Whitelist
Addresses in `RegistryContract` bypass the daily velocity cap entirely. The `DripList` component makes this explicit so users understand why some transfers don't count against their limit.

```tsx
// src/components/DripList.tsx
// Each row shows address + "bypasses cap" badge
<DripList />
```

### Freighter Wallet Integration
```ts
// src/hooks/useWallet.ts
const { publicKey, connected, connect, sign } = useWallet();

// Connect
await connect();  // calls Freighter's getPublicKey()

// Sign a Soroban transaction
const signedXdr = await sign(assembledTx.toXDR());

// Relay through backend (keeps BACKEND_URL server-side)
const { hash, status } = await relayTransaction({ signedXdr });
```

### Backend Proxy
All calls to `stellar-shield-backend` go through a Next.js catch-all route. `BACKEND_URL` is never sent to the browser:

```ts
// src/app/api/backend/[...path]/route.ts
const upstream = await fetch(`${process.env.BACKEND_URL}/${tail}${search}`, {
  method: req.method,
  headers,
  body: req.body,
});
return new NextResponse(upstream.body, { status: upstream.status });
```

---

## 📁 Project Structure

```
stellar-shield-frontend/
├── .drips/
│   ├── wave.json              # Drips Wave contribution types + point values
│   ├── splits.json            # Reward pool split (maintainer / contributors / protocol)
│   └── README.md              # How to earn drips
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout
│   │   ├── page.tsx                        # → redirect /dashboard
│   │   ├── dashboard/page.tsx              # Main dashboard UI
│   │   └── api/backend/[...path]/route.ts  # Proxy → BACKEND_URL
│   ├── components/
│   │   ├── VelocityGauge.tsx               # SVG radial chart
│   │   ├── DripList.tsx                    # Trusted drip addresses
│   │   └── AuthModal.tsx                   # WebAuthn biometric prompt
│   ├── hooks/
│   │   ├── useWallet.ts                    # Freighter connect / sign
│   │   ├── usePasskey.ts                   # WebAuthn register / assert
│   │   └── useVelocity.ts                  # Polls backend for limit/spent
│   └── lib/
│       ├── constants.ts                    # STROOPS_PER_XLM, toStroops, fromStroops
│       ├── soroban.ts                      # Typed wrappers for all three contracts
│       └── api.ts                          # Typed client for stellar-shield-backend
├── .env.local.example
├── next.config.ts
├── package.json
└── plan.md                                 # Wave contribution plan
```

---

## 🔗 Contract Interface

The frontend talks to three Soroban contracts. All amounts cross the boundary in **stroops** (`1 XLM = 10,000,000 stroops`).

```ts
// src/lib/soroban.ts

// Set a daily spending limit
const tx = await buildSetLimit(account, publicKey, toStroops(500)); // 500 XLM

// Execute a transfer (Freighter must sign — user.require_auth())
const tx = await buildExecuteTransfer(account, publicKey, recipient, toStroops(10));

// Register a passkey public key (65-byte uncompressed SEC1 point)
const tx = await buildRegisterKey(account, publicKey, pubkeyBytes);

// Check if an address bypasses the velocity cap
const trusted: boolean = await isTrustedDrip(address);
```

```ts
// src/lib/constants.ts
export const toStroops  = (xlm: number): bigint => BigInt(Math.round(xlm * 10_000_000));
export const fromStroops = (s: bigint): number  => Number(s) / 10_000_000;
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- [Freighter wallet](https://freighter.app) browser extension
- Deployed `stellar-shield-contract` (see that repo's README)
- Running `stellar-shield-backend`

### Install & run

```bash
# 1. Clone
git clone https://github.com/your-org/stellar-shield-frontend
cd stellar-shield-frontend

# 2. Install
npm install

# 3. Configure
cp .env.local.example .env.local
# Edit .env.local — fill in contract IDs from your deployment

# 4. Run
npm run dev   # http://localhost:3000
```

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_GUARD_CONTRACT_ID` | Deployed `GuardContract` address |
| `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` | Deployed `RegistryContract` address |
| `NEXT_PUBLIC_AUTH_CONTRACT_ID` | Deployed `AuthContract` address |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | Soroban RPC (default: testnet) |
| `NEXT_PUBLIC_HORIZON_URL` | Horizon (default: testnet) |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | Network passphrase |
| `BACKEND_URL` | `stellar-shield-backend` base URL — **server-side only, never exposed to browser** |

---

## 🌊 Contributing via Drips Wave

StellarShield runs a Drips Wave that pays contributors in XLM for merged PRs. See `.drips/wave.json` for the full list of open tasks and point values, and `plan.md` for the sprint schedule.

**Highest-value open tasks:**
- 🦀 New Guard module (e.g. `time_delay_guard.rs`) — **500 pts**
- 🔐 Wire `secp256r1_verify` in `auth.rs` — **400 pts**
- ⚙️ Token transfer integration in `guard.rs` — **400 pts**
- 🧪 Contract test suite — **200 pts**

To claim a task: comment on the GitHub issue, build it, open a PR. Once merged, your drip starts automatically.

---

## 📐 Shared Constants

```
STROOPS_PER_XLM  = 10_000_000
LEDGERS_PER_DAY  = 17_280        (≈ 5 s/ledger × 86,400 s/day)
TEMP_TTL_LEDGERS = 34_560        (2 days — daily spend counter lifetime)
```

## ⚠️ Integration Rules

- **Never** convert WebAuthn DER signatures to compact form in the frontend — the backend owns that step.
- **Always** convert XLM ↔ stroops at the UI boundary using `toStroops` / `fromStroops`.
- `execute_transfer` requires `user.require_auth()` — Freighter **must** sign the transaction before relay.
- Drip addresses bypass the velocity check — make this visible in the UI so users aren't confused.

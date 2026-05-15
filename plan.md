# 🌊 StellarShield Wave Program — Contribution Plan

StellarShield is a programmable security layer for Stellar wallets. This document describes the scoped work maintainers will post for contributors during each sprint cycle, and how rewards flow through the Drips Wave.

---

## How It Works

1. Maintainer opens a GitHub issue tagged with a contribution type and point value.
2. A contributor comments to claim it, then opens a PR referencing the issue.
3. Once the PR is merged, the Wave Oracle detects it and begins the contributor's reward drip automatically.
4. Points accumulate across sprints — higher points = larger share of the reward pool.

---

## Types of Work

### 🦀 New Guard Modules — 500 pts each
The highest-value contribution. A Guard module is a new Rust file in `stellar-shield-contract/src/` that enforces a new security rule on top of the existing velocity framework.

**Examples of issues we'll post:**
- `time_delay_guard.rs` — large transfers (>100 XLM) require a 24-hour delay before execution
- `ip_lock_guard.rs` — restrict transfers to sessions that match a registered device fingerprint
- `multi_sig_guard.rs` — require N-of-M passkey signatures for transfers above a threshold

Each module must include a `#[test]` block using `soroban-sdk` testutils.

---

### 🔐 Security Fixes — 400 pts each
Critical gaps in the current codebase that need a qualified contributor to close.

**Issues we'll post:**
- Wire `env.crypto().secp256r1_verify()` in `auth.rs` — the contract currently stores P-256 keys but `verify_sig` returns `false` until this is implemented
- Implement the actual XLM token contract `transfer()` call in `guard.rs` after the velocity check passes — currently a stub
- Full WebAuthn `authenticatorData` + `clientDataJSON` verification in the backend `auth` route per the W3C spec

These are load-bearing — nothing works end-to-end without them.

---

### 🧪 Testing — 200 pts each
No test suite exists yet. Contributors can claim individual contract test files.

**Issues we'll post:**
- `tests/guard_tests.rs` — velocity limit enforcement, daily rollover, drip bypass
- `tests/registry_tests.rs` — add/remove trusted drip, safe default false
- `tests/auth_tests.rs` — register key, threshold, verify_sig stub behaviour
- Frontend integration tests using Playwright — connect wallet flow, gauge rendering

---

### ⚙️ Backend Features — 300 pts each
The backend is a separate repo (`stellar-shield-backend`) that contributors can scaffold and extend.

**Issues we'll post:**
- Event indexer — listen for `execute_transfer` and `add_trusted_drip` Soroban contract events and store them in SQLite so the frontend doesn't hit RPC on every load
- `GET /registry/drips` — replace the current query-param workaround with a proper indexed drip list
- Rate limiting + request validation middleware (Zod schemas on all routes)
- Docker Compose setup for local development (backend + Soroban RPC quickstart)

---

### 📖 Documentation — 100 pts each
Good docs lower the barrier for the next contributor.

**Issues we'll post:**
- Deployment walkthrough — step-by-step from `cargo build` to a live testnet contract with real IDs
- Frontend setup guide with screenshots
- Architecture diagram (contract → backend → frontend data flow)
- `CONTRIBUTING.md` — how to claim an issue, branch naming, PR checklist

---

## Sprint Cadence

| Sprint | Focus |
|---|---|
| Sprint 1 | Security fixes (secp256r1, token transfer) + test suite |
| Sprint 2 | Backend repo scaffold + event indexer |
| Sprint 3 | New Guard modules (time_delay, multi_sig) |
| Sprint 4 | Frontend polish + documentation |

Each sprint runs for **2 weeks**. Unclaimed issues roll over to the next sprint with a 50-point bonus.

---

## Reward Pool

50% of the pool goes to contributors, split proportionally by points earned in the sprint. 40% is retained by the maintainer for ongoing development. 10% goes to the Drips protocol.

Fill in your Stellar address in `.drips/splits.json` to start receiving drips when the Wave is live.

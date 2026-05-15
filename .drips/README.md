# 💧 StellarShield — Drips Wave Config

This directory configures the Drips Wave that funds StellarShield contributors.

## How to earn Drips

1. Fork any of the three StellarShield repos.
2. Pick an open contribution from `wave.json` (each has a point value).
3. Build it, open a PR, get it merged.
4. The Wave Oracle detects the merge and begins your reward drip automatically.

## Contribution point values

| Task | Points |
|---|---|
| New Guard module (e.g. `time_delay_guard.rs`) | 500 |
| Wire P-256 `secp256r1_verify` in `auth.rs` | 400 |
| Token contract transfer in `guard.rs` | 400 |
| Event indexer (backend DB) | 300 |
| Full WebAuthn verification (backend) | 300 |
| Contract test suite | 200 |
| Bug fix | 100 |

## Files

- `wave.json` — Wave metadata and contribution type definitions
- `splits.json` — How the reward pool is split between maintainer, contributors, and protocol

## Setup

1. Deploy your Stellar address into `splits.json` under `"Project maintainer"`.
2. Register the wave at [drips.network](https://drips.network) pointing to this repo.
3. Fund the reward pool address in `wave.json → rewardAddress`.

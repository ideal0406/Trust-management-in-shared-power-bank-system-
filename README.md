# Blockchain-Based Decentralized Identity and Trust Management for Shared Power Banks

> A research prototype that combines Hyperledger Fabric, decentralized identifiers, verifiable credentials, threshold secret sharing, and behavior-driven trust scoring for shared power bank services.

## Overview

Most shared power bank platforms rely on a central service provider to manage user identities, device records, unlock credentials, and credit scores. Although convenient, this architecture creates a single point of failure and increases the risks of identity impersonation, data tampering, credential leakage, and unauthorized device access.

This project demonstrates a decentralized alternative in which:

1. users and power banks receive Ed25519-based `did:key` identities;
2. users authenticate with signed JWT-based Verifiable Credentials (VCs);
3. Hyperledger Fabric stores trusted user, device, score, password-hash, and secret-share states;
4. rental benefits are calculated from the latest on-chain trust score;
5. an unlock password is reconstructed only when at least 3 of 5 Shamir shares are available;
6. return events dynamically affect future trust scores through a Flower-based distributed update layer.

The repository accompanies the thesis **“Blockchain-Based Decentralized Identity and Trust Management for Shared Power Bank Services.”** It is a proof of concept intended for research and demonstration, not a production-ready rental platform.

## Highlights

| Capability | Implementation | Purpose |
|---|---|---|
| Decentralized identity | `did:key` with Ed25519 | Gives users and devices cryptographically verifiable identifiers |
| User credentials | JWT VC with EdDSA signature | Proves that a requester controls the credential associated with a DID |
| Trusted state management | Hyperledger Fabric and Go chaincode | Stores registrations, scores, password hashes, and secret shares |
| Unlock-secret protection | 3-of-5 Shamir Secret Sharing | Avoids relying on one directly stored plaintext password |
| Trust-based authorization | Score-based deposits, discounts, rental limits, and fast-charging benefits | Turns reputation into practical service privileges |
| Behavior-driven scoring | Flower clients and return events | Updates user trust according to actual rental behavior |
| Auditable score updates | Fabric transactions and `ScoreUpdated` events | Reduces the risk of silent database manipulation |

## Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│ 4. Federated Trust Update Layer                               │
│ Flower server and clients process return events and scores    │
├───────────────────────────────────────────────────────────────┤
│ 3. Application Layer                                         │
│ Node.js scripts handle identity, VCs, registration, and rent  │
├───────────────────────────────────────────────────────────────┤
│ 2. Blockchain Trust Layer                                    │
│ Hyperledger Fabric and Go chaincode manage trusted state      │
├───────────────────────────────────────────────────────────────┤
│ 1. Identity and Credential Layer                             │
│ DID:key, Ed25519, and JWT VCs represent users and devices     │
└───────────────────────────────────────────────────────────────┘
```

An unlock request passes through four linked checks:

```text
Credential verification
        ↓
Latest on-chain trust score
        ↓
Threshold secret reconstruction
        ↓
On-chain password-hash verification
```

Possessing only a DID, one secret share, or an outdated local score is therefore insufficient to complete the intended unlock workflow.

## Repository Structure

```text
code/
├── chaincode/
│   └── trustmgmtv2(2).go
└── scripts/
    ├── system scripts/
    │   ├── fabric-utils.mjs
    │   ├── import-admin.mjs
    │   ├── get-score-cli.mjs
    │   ├── update-score-cli.mjs
    │   └── reset-system.mjs
    └── workflow scripts/
        ├── generate-users.mjs
        ├── generate-powerbanks.mjs
        ├── register-single-user.mjs
        ├── register-powerbanks-to-fabric.mjs
        ├── setup-powerbanks-fabric.mjs
        ├── unlock-fabric.mjs
        ├── return-powerbank-fabric.mjs
        ├── fl_client.py
        └── fl_server.py
```

### Main Components

| File | Responsibility |
|---|---|
| `trustmgmtv2(2).go` | Fabric smart contract for user, score, power bank, hash, and secret-share state |
| `fabric-utils.mjs` | Shared Fabric Gateway connection and transaction helpers |
| `generate-users.mjs` | Generates a user DID, Ed25519 key pair, and signed JWT VC |
| `generate-powerbanks.mjs` | Generates five power bank identities and local credentials |
| `setup-powerbanks-fabric.mjs` | Creates a fresh password, splits it into five shares, and stores its hash |
| `unlock-fabric.mjs` | Verifies the VC, evaluates privileges, reconstructs the password, and checks its hash |
| `return-powerbank-fabric.mjs` | Records a successful or failed return event locally |
| `fl_client.py` | Calculates behavior-based scores and submits score updates to Fabric |
| `fl_server.py` | Aggregates client-reported score metrics into a local experimental ledger |

## Data Models

### User

```json
{
  "did": "did:key:...",
  "name": "Alice",
  "trustScore": 0.85,
  "successCount": 0,
  "failureCount": 0,
  "createdAt": "2026-..."
}
```

The DID is used directly as the Fabric World State key. The current chaincode includes success and failure counters, but the provided scoring scripts update only `trustScore`.

### Power Bank

```json
{
  "did": "did:key:...",
  "publicKey": "{...JWK...}",
  "passwordHash": "sha256...",
  "shares": {
    "0": "base64-share",
    "1": "base64-share"
  },
  "owner": "",
  "status": "available"
}
```

`shares` contains Base64-encoded Shamir shares. `passwordHash` is the verification reference for the reconstructed password. The current application workflow does not yet enforce `owner` or `status` transitions.

## Chaincode API

| Function | Type | Description |
|---|---|---|
| `RegisterUser(did, name, initialTrustScore)` | Submit | Registers a user and records the initial score and transaction time |
| `GetTrustScore(userDID)` | Evaluate | Returns the latest user trust score |
| `UpdateTrustScore(userDID, newScore)` | Submit | Updates the score and emits a `ScoreUpdated` event |
| `RegisterPowerBank(did, publicKey, passwordHash)` | Submit | Registers a power bank with an initial `available` status |
| `StoreSecretShare(powerBankDID, index, share)` | Submit | Stores one encoded secret share |
| `GetSecretShares(powerBankDID)` | Evaluate | Returns all shares associated with a device |
| `UpdatePowerBankPasswordHash(did, hash)` | Submit | Replaces a device password hash |
| `GetPowerBankPasswordHash(did)` | Evaluate | Returns the current password hash |
| `ClearAllData()` | Submit | Deletes ledger keys beginning with `did:` for experiment reset |

> [!CAUTION]
> `ClearAllData`, `UpdateTrustScore`, and the secret-management functions require role- or attribute-based access control before any non-experimental deployment.

## Trust Score Model

Trust scores are clipped to `[0, 1]`. The current implementation uses `α = 0.003` for a successful return and `β = 0.006` for a failed return:

```text
Successful return: T_next = clip(T + α × (1 - T), 0, 1)
Failed return:     T_next = clip(T - β × T,       0, 1)
```

This is not a fixed reward-and-penalty model. Lower-score users have more room to recover after positive behavior, while a failure causes a larger absolute deduction for a user whose current score is high.

### Rental Benefits

| Trust score | Level | Deposit | Price factor | Concurrent rentals | Fast charging |
|---:|---|---:|---:|---:|---|
| `T ≥ 0.9` | VIP | CNY 0 | 80% | 3 | Enabled |
| `0.7 ≤ T < 0.9` | Common | CNY 49 | 90% | 2 | Disabled |
| `T < 0.7` | Basic | CNY 99 | 100% | 1 | Disabled |

These benefits are currently calculated and displayed by the CLI. They are not yet persisted as rental orders or connected to actual charging hardware.

## End-to-End Workflow

```text
Generate user and device identities
                │
                ▼
Register users and power banks on Fabric
                │
                ▼
Generate an unlock password
                │
                ├── Split it into 5 shares; any 3 can recover it
                └── Store its SHA-256 hash on Fabric
                │
                ▼
Submit user DID, power bank DID, and user VC
                │
                ▼
Verify the VC signature and subject
                │
                ▼
Read the latest trust score and calculate benefits
                │
                ▼
Retrieve at least 3 shares and reconstruct the password
                │
                ▼
Compare its SHA-256 hash with the on-chain reference
                │
          ┌─────┴─────┐
          ▼           ▼
       Reject       Unlock
                        │
                        ▼
Record return result and update the trust score
```

## Technology Stack

The thesis prototype uses the following environment:

| Component | Technology / Version |
|---|---|
| Permissioned blockchain | Hyperledger Fabric 2.5 |
| Chaincode | Go 1.19+ |
| Fabric client SDK | `fabric-network` 2.2.0 |
| Application scripts | Node.js 18.20.8 with ES modules |
| Federated framework | Flower 1.6.0 |
| Cryptography | Ed25519, EdDSA, SHA-256, JWT, Shamir Secret Sharing |
| DID generation | `@transmute/did-key-ed25519` |
| Containers | Docker and Docker Compose |

### Node.js Dependencies

- `fabric-network@2.2.0`
- `@transmute/did-key-ed25519`
- `jose`
- `shamir-secret-sharing`

### Python Dependencies

- `flwr==1.6.0`
- `numpy`

## Before You Run the Project

The current repository is a thesis experiment snapshot. It does not include a `package.json`, lockfile, `go.mod`, Fabric deployment automation, or a complete configuration layer.

The scripts are also divided between `system scripts` and `workflow scripts`, while several workflow files import `./fabric-utils.mjs`. In addition, `fl_client.py` expects `get-score-cli.mjs` and `update-score-cli.mjs` to be available from its current working directory. The repository will therefore require a small amount of path cleanup before it can run end to end.

### Recommended Script Layout

For the simplest experiment setup, place the runtime scripts in one directory:

```text
runtime/
├── fabric-utils.mjs
├── import-admin.mjs
├── get-score-cli.mjs
├── update-score-cli.mjs
├── generate-users.mjs
├── generate-powerbanks.mjs
├── register-single-user.mjs
├── register-powerbanks-to-fabric.mjs
├── setup-powerbanks-fabric.mjs
├── unlock-fabric.mjs
├── return-powerbank-fabric.mjs
├── fl_client.py
└── fl_server.py
```

Alternatively, keep the current folders and update imports such as:

```js
import {
  submitTransaction,
  evaluateTransaction
} from '../system scripts/fabric-utils.mjs'
```

The subprocess paths in `fl_client.py` should likewise be resolved from the Python file's directory or replaced with explicit configurable paths.

## Installation

### 1. Install Node.js Dependencies

Run these commands in the prepared runtime directory:

```bash
npm init -y
npm pkg set type=module
npm install fabric-network@2.2.0 @transmute/did-key-ed25519 jose shamir-secret-sharing
```

### 2. Install Python Dependencies

```bash
python -m venv .venv
source .venv/bin/activate
pip install flwr==1.6.0 numpy
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Prepare Hyperledger Fabric

Start the Fabric 2.5 `test-network`, create `mychannel`, and deploy the contract as `trustmgmtv2`.

The chaincode directory also requires a Go module:

```bash
go mod init trustmgmtv2
go get github.com/hyperledger/fabric-contract-api-go/contractapi
go mod tidy
```

The provided Fabric utility expects these values:

```text
Channel:  mychannel
Contract: trustmgmtv2
Identity: admin
MSP:      Org1MSP
```

Refer to the official Hyperledger Fabric documentation for the complete test-network and chaincode deployment procedure.

### 4. Configure Local Paths

The following paths are currently hard-coded for the original WSL development environment and must be changed:

```js
// fabric-utils.mjs
const ccpPath = '/mnt/d/MyProjects/charging-project/fabric-samples/test-network/.../connection-org1.json'
const walletPath = '/tmp/wallet'

// import-admin.mjs
const testNetworkPath = '/mnt/d/MyProjects/charging-project/fabric-samples/test-network'
```

For a reusable setup, replace them with environment variables such as:

```text
FABRIC_TEST_NETWORK
FABRIC_CCP_PATH
FABRIC_WALLET_PATH
```

### 5. Import the Fabric Administrator

```bash
node import-admin.mjs
```

This imports the Org1 administrator certificate and private key into the configured file-system wallet under the identity name `admin`.

## Quick Start

The commands below assume that:

- all runtime scripts are in the current directory;
- Fabric is running;
- `mychannel` exists;
- `trustmgmtv2` is deployed;
- the `admin` identity has been imported.

### 1. Generate a User

```bash
node generate-users.mjs
```

The script prompts for one name and creates:

- an Ed25519 key pair;
- a `did:key` identifier;
- an initial trust score, currently `0.85` for the single generated user;
- a signed JWT VC;
- `users.json`.

> [!WARNING]
> `users.json` contains private-key material and is suitable only for local experiments. Never commit it to a public repository.

### 2. Generate Power Banks

```bash
node generate-powerbanks.mjs
```

The script creates five devices and writes them to `powerbanks.json`. Each device receives an independent DID, Ed25519 key pair, random password, and SHA-256 password hash.

### 3. Register Users and Devices

```bash
node register-single-user.mjs
node register-powerbanks-to-fabric.mjs
```

The first command registers only the first entry in `users.json`. The second registers all power banks.

### 4. Create the Threshold Unlock Secret

```bash
node setup-powerbanks-fabric.mjs
```

For each registered device, the script:

1. generates a fresh random password;
2. splits it into five Shamir shares with a threshold of three;
3. stores all encoded shares through `StoreSecretShare`;
4. stores the new password hash through `UpdatePowerBankPasswordHash`.

### 5. Request an Unlock

Read the user DID and VC from `users.json`, and a device DID from `powerbanks.json`:

```bash
node unlock-fabric.mjs <userDID> <powerbankDID> "<VC_JWT>"
```

A successful run displays:

- VC signature and subject verification;
- latest on-chain trust score;
- trust level, deposit, discount, and rental limit;
- available secret-share count;
- password reconstruction and hash verification;
- final unlock result.

### 6. Record a Return Event

Successful return:

```bash
node return-powerbank-fabric.mjs <userDID> <powerbankDID> true
```

Failed return:

```bash
node return-powerbank-fabric.mjs <userDID> <powerbankDID> false
```

Events are appended to `events.json`:

```json
{
  "user_did": "did:key:...",
  "powerbank_did": "did:key:...",
  "success": true,
  "timestamp": 1770000000000
}
```

### 7. Run the Trust Update Layer

Start the Flower server:

```bash
python fl_server.py
```

Then start at least one client in another terminal:

```bash
python fl_client.py <powerbankDID>
```

The client reads and clears `events.json`, groups events by user, calculates new scores, and invokes the Node.js CLI to update Fabric. The Flower server aggregates client evaluation metrics into `ledger.json`.

> [!NOTE]
> `fl_server.py` opens `ledger.json` in `r+` mode. Create the file with a valid JSON object such as `{}` before starting the server. The server updates this local experimental ledger; the actual Fabric update is submitted by the client.

### Query or Manually Update a Score

```bash
node get-score-cli.mjs <userDID>
node update-score-cli.mjs <userDID> <newScore>
```

The current chaincode does not restrict manual scores to `[0, 1]` and does not authorize the caller by role. Treat this interface as an experiment-only administration tool.

### Reset the Experiment

```bash
node reset-system.mjs
```

This calls `ClearAllData` and deletes these files from the current working directory when present:

- `users.json`
- `powerbanks.json`
- `events.json`
- `ledger.json`
- `real-entities.json`

> [!CAUTION]
> The reset operation is destructive and must not be exposed in a production system.

## Security Coverage

The following table distinguishes implemented controls from thesis-level design goals.

| Threat | Intended defense | Current implementation status |
|---|---|---|
| Identity impersonation | Ed25519-signed JWT VC and DID-subject matching | Basic verification implemented |
| Trust-score tampering | Fabric transaction workflow and auditable updates | Implemented, but caller authorization is missing |
| Unlock-password theft | 3-of-5 Shamir reconstruction and SHA-256 verification | Prototype implemented; all shares currently reside in one ledger object |
| Replay attack | Timestamp freshness and nonce tracking | Described in the thesis, not implemented in the unlock script |
| Duplicate identity / Sybil abuse | On-chain DID uniqueness | Prevents one DID from being registered twice, but not multiple independently generated DIDs |
| Unknown device | Registered device state required for chain queries | Unknown devices fail indirectly; full `status` enforcement is not implemented |
| Expired or revoked credential | VC expiration and revocation checks | Not implemented |

## Evaluation Summary

The thesis evaluates the prototype from four perspectives:

1. **Behavior-driven trust evolution** — repeated successful returns move the score toward 1, while failures reduce it in proportion to its current value.
2. **Multi-factor rental authorization** — legitimate requests pass, while forged credentials, DID/VC mismatches, modified secrets, and unknown devices are rejected or restricted in the evaluated scenarios.
3. **Security analysis** — the combination of DID/VC verification, Fabric state, secret sharing, and dynamic trust reduces the risks of identity forgery, score manipulation, and direct password leakage.
4. **Transaction latency** — registration, share storage, and score updates are slower than read-only queries because writes pass through endorsement, ordering, validation, and ledger commitment.

The repository does not include the raw measurement dataset or an automated benchmark suite, so the exact latency chart from the thesis cannot currently be reproduced from source alone.

## Known Limitations

- No `package.json`, dependency lockfile, `go.mod`, Fabric deployment script, or automated test suite is included.
- Fabric paths, wallet paths, channel name, contract name, and administrator identity are hard-coded.
- User and device private keys are stored in local JSON files.
- The user self-signs the current VC; there is no independent trusted issuer, revocation registry, or expiration policy.
- Chaincode functions do not yet enforce MSP/attribute-based access control or score-range validation.
- All five Shamir shares are stored under the same power bank ledger object rather than distributed across independent custodians.
- `events.json` is cleared after a client reads it, creating possible races or lost events with concurrent clients.
- The Flower layer exchanges score metrics rather than training a machine-learning model; secure aggregation and client authentication are not implemented.
- `successCount`, `failureCount`, `owner`, and device `status` are not integrated into the complete workflow.
- Deposits, discounts, rental limits, and fast charging are displayed but not connected to payments, orders, or physical hardware.
- Thesis-described nonce-based replay protection and complete device-state validation are not implemented in the current code.

## Roadmap

- [ ] Add reproducible Node.js and Go dependency manifests.
- [ ] Add a Docker-based Fabric setup and one-command development environment.
- [ ] Move network configuration and paths to environment variables.
- [ ] Add MSP- and role-based chaincode authorization.
- [ ] Add strict input validation and a complete rental state machine.
- [ ] Introduce a trusted VC issuer, expiration, challenge/nonce handling, and revocation.
- [ ] Distribute secret shares across independent organizations or storage nodes.
- [ ] Replace local JSON event handling with a durable, idempotent event pipeline.
- [ ] Extend scoring with return delay, damage, abnormal unlocks, disputes, and long-term behavior.
- [ ] Add chaincode unit tests, end-to-end tests, negative security tests, and reproducible benchmarks.

## Suggested `.gitignore`

The generated files contain sensitive or environment-specific data and should not be committed:

```gitignore
node_modules/
.venv/
.env

users.json
powerbanks.json
events.json
ledger.json
real-entities.json

wallet/
*.pem
*_sk
```

## Academic Context

This code supports the final-year project thesis **“Blockchain-Based Decentralized Identity and Trust Management for Shared Power Bank Services”** by Xiang Li. The project explores whether Hyperledger Fabric, decentralized identity, threshold secrets, and distributed trust updates can form a practical security workflow for shared rental devices.

If you use or extend this work in academic research, please cite the associated thesis according to your institution's required format.

## Disclaimer

This project is provided for academic research, education, and security-mechanism demonstration only. It includes experimental administration functions, local private-key storage, hard-coded development paths, and state-changing interfaces without production-grade authorization. Do not deploy it with real users, payments, or connected hardware without a full security review and substantial engineering work.


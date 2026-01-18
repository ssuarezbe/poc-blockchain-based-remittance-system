# Puente PoC Walkthrough

This guide will help you run and verify the Puente Blockchain-based Remittance System Proof of Concept.

## Prerequisites

- Node.js (v18+)
- PostgreSQL (running locally or via Docker)
- MetaMask or another Web3 wallet installed in your browser

## 1. Environment Setup

Ensure you have populated the `.env` files in both `backend` and `frontend` directories.

### Backend `.env`
Located at `puente-poc/backend/.env`. You can copy `.env.example`.
Update the variables, especially the Database credentials and Blockchain config.
For local development with Hardhat, you can use the default keys provided by Hardhat (see `npx hardhat node` output).

### Frontend `.env`
Located at `puente-poc/frontend/.env`. Copy `.env.example`.
`VITE_API_URL=http://localhost:3000`

## 2. Start the Blockchain (Hardhat)

Open a terminal and run the local blockchain node:

```bash
cd puente-poc/contracts
npx hardhat node
```

In a **separate terminal**, deploy the contracts to the local network:

```bash
cd puente-poc/contracts
npx hardhat run scripts/deploy.ts --network localhost
```

**Note:** Copy the `USDC_ADDRESS` and `ESCROW_ADDRESS` from the deployment output and update them in your `backend/.env` file (`ESCROW_CONTRACT_ADDRESS` and potentially logic if you hardcoded USDC address).
*The system is designed to fetch addresses from config, but make sure they match.*

## 3. Start the Backend

Open a new terminal:

```bash
cd puente-poc/backend
npm install
npm run start:dev
```

The backend should start on port 3000. It will automatically create the database tables.

## 4. Start the Frontend

Open a new terminal:

```bash
cd puente-poc/frontend
npm install
npm run dev
```

The frontend will start (usually at `http://localhost:5173`).

## 5. Verification Steps

1.  **Open the App**: Go to `http://localhost:5173` in your browser.
2.  **Register**: Create a new account.
3.  **Connect Wallet**: Click "Connect Wallet".
    *   *Tip:* Import a Hardhat test account (private key from `npx hardhat node`) into MetaMask to have funds (ETH) for gas.
    *   *Tip:* Use the "Get Test USDC" button in the wallet component to mint yourself some mock USDC.
4.  **Create Remittance**:
    *   Click "New Remittance".
    *   Enter Recipient ID, Name, and Amount (e.g., 100 USDC).
    *   Confirm the transaction (MetaMask will pop up).
5.  **Fund Remittance**:
    *   Go to Dashboard.
    *   You should see the "Created" remittance.
    *   Click "Fund Remittance".
    *   Approve USDC spending (MetaMask).
    *   Confirm Deposit (MetaMask).
    *   Status should change to "Funded".
6.  **Completion (Operator)**:
    *   *Note:* In this PoC, the "Release" functionality is restricted to the contract owner (Operator).
    *   You can verify the release logic by running the backend tests or using the Hardhat console.

## Troubleshooting

- **MetaMask Network**: Ensure MetaMask is connected to `Localhost 8545`. Chain ID: `31337` (or `1337`).
- **Reset**: If you restart `npx hardhat node`, you must also reset your MetaMask account "Activity" (Settings > Advanced > Clear activity tab data) to avoid nonce errors, and redeploy contracts.

## 6. Unit Tests (Podman + Bun)

To run the backend unit tests using Podman and Bun, execute the following commands in the root directory:

```bash
cd puente-poc/backend
podman build -f Dockerfile.test -t puente-backend-test .
podman run --rm puente-backend-test
```

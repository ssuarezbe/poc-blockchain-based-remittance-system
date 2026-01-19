# Puente PoC

Proof of Concept for a blockchain-based remittance system.

## 🚀 Running Locally

This project uses **Podman** and **Taskfile** for easy local deployment and management.

### Prerequisites

- [Podman](https://podman.io/) (and `podman-compose`)
- [Task](https://taskfile.dev/) (go-task)
- Node.js (v18+) - *Optional, for running without containers*
- MetaMask (or another Web3 wallet)

### Quick Start

1.  **Setup & Start**:
    This command builds all Docker images, starts the services (Blockchain, DB, Backend, Frontend), and deploys the smart contracts to the local network.

    ```bash
    task setup
    ```

    *Note: This may take a few minutes the first time to pull images and build.*

2.  **Access the App**:
    - Frontend: http://localhost:5173
    - Backend API: http://localhost:3000
    - Blockchain JSON-RPC: http://localhost:8545

3.  **View Logs**:
    To see the logs of all running services:

    ```bash
    task logs
    ```

4.  **Run Tests**:
    To run the backend unit tests (using Bun inside a Podman container):

    ```bash
    task test
    ```

5.  **Stop Services**:

    ```bash
    task down
    ```

### Manual Configuration (If needed)

- **Smart Contracts**: The `setup` task automatically deploys contracts using the default Hardhat account.
- **Backend**: The `docker-compose.yml` is pre-configured to talk to the local blockchain container. If you deploy manually or address changes, update `ESCROW_CONTRACT_ADDRESS` in `backend/.env`.

### Wallet Setup

1.  Connect MetaMask to **Localhost 8545**.
    - Chain ID: `31337`
2.  Import an Account:
    - Use the private key from the Hardhat node output (account #0 is used by the operator, use #1 or others for testing sender flow).
    - Default Test Key (Sender): `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` (Account #1)

## Project Structure

- `contracts/`: Hardhat project for Smart Contracts (Solidity)
- `backend/`: NestJS API (Port 3000)
- `frontend/`: React + Vite UI (Port 5173)

## 📊 Remittance Status Workflow

Understanding the lifecycle of a remittance is key to debugging and verification.

### Status Definitions

- `PENDING`: Initial state when user starts the flow. Database record created, but blockchain transaction not yet initiated or confirmed.
- `CREATED`: Blockchain contract (Escrow) has successfully created the remittance record on-chain.
- `FUNDED`: User has deposited the USDC amount into the contract. Funds are locked.
- `COMPLETED`: Admin/Operator has released the funds to the recipient. Cycle complete.
- `REFUNDED`: Admin/Operator has returned the funds to the sender.
- `FAILED`: An error occurred during creation or processing.

### ✅ Successful Flow

1.  **PENDING** → **CREATED**:
    -   User clicks "Create".
    -   Backend creates DB record (`PENDING`).
    -   Backend signs and sends `createRemittance` tx to blockchain.
    -   On tx success, status updates to `CREATED`.

2.  **CREATED** → **FUNDED**:
    -   User clicks "Fund" in Dashboard.
    -   Backend signs and sends `deposit` tx to blockchain.
    -   On tx success, status updates to `FUNDED`.

3.  **FUNDED** → **COMPLETED**:
    -   Admin reviews and clicks "Complete" (Release).
    -   Backend signs and sends `release` tx.
    -   On tx success, status updates to `COMPLETED`.

### ❌ Error/Alternative Flows

-   **PENDING** → **FAILED**:
    -   If the blockchain transaction to create the remittance fails (e.g., operator out of gas, contract reverted).
    -   The remittance stops here and cannot be funded.

-   **FUNDED** → **REFUNDED**:
    -   If the transaction cannot be completed (e.g., incorrect recipient), Admin clicks "Refund".
    -   Funds are returned to sender on-chain.
    -   Status updates to `REFUNDED`.

-   **Stuck in PENDING?**
    -   Check backend logs. It usually means the blockchain transaction is incomplete or the backend failed to update the status after the transaction.

## ✅ Manual Verification Steps

Follow these steps to verify the system works locally:

1.  **Open the App**:
    Typically [http://localhost:5173](http://localhost:5173).

2.  **Login**:
    -   Click "Login".
    -   Use the default seeded user:
        -   **Email**: `default@example.com`
        -   **Password**: `defa-key-2026$`
    -   *Or Register a new user manually.*

3.  **Connect Wallet**:
    -   Click "Connect Wallet".
    -   Ensure MetaMask is connected to **Localhost 8545** (`Chain ID: 31337`).
    -   **Important**: Use a Hardhat test account (Account #1 or later). Do not use Account #0 as it is the Operator (owner).
    -   Use "Get Test USDC" to mint tokens if needed.

4.  **Create Remittance**:
    -   Go to "New Remittance".
    -   Enter Recipient ID (email or mock ID) and Amount (e.g., 100 USDC).
    -   Confirm transaction in MetaMask.

5.  **Fund Remittance**:
    -   Go to Dashboard (Remittances List).
    -   Find the "Created" remittance.
    -   Click "Fund".
    -   Approve USDC spending cap -> Confirm.
    -   Confirm Deposit transaction.
    -   Status should update to "Funded".

6.  **Verify Backend**:
    -   Check [http://localhost:3000/](http://localhost:3000/). Should respond: "Puente PoC Backend is Running!".

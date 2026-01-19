# Puente PoC — Technical Specification

> **Purpose**: This specification enables LLM coding assistants (Claude Code, Cursor, Copilot, etc.) to generate a complete, working proof of concept for a blockchain-based remittance system.

---

## 1. Project Overview

### 1.1 What We're Building

A simplified blockchain-powered remittance system that allows users to send USDC from the US to Colombia, with the smart contract acting as an escrow until the recipient receives local currency (COP).

### 1.2 Core User Flow

1. Sender creates a remittance (specifies amount in USD and recipient info).
2. Backend creates record in DB and executes `createRemittance` transaction on-chain (Server Wallet).
3. Sender clicks "Fund" in UI.
4. Backend executes `approve` and `deposit` transactions on-chain (Server Wallet).
5. Operator (admin) confirms off-chain COP delivery.
6. Smart contract releases funds / marks complete.

### 1.3 Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.20+, Hardhat, OpenZeppelin |
| Backend | NestJS 10+, TypeScript, TypeORM, PostgreSQL, ethers.js v6 (Server Signing) |
| Frontend | React 18+, Vite, TypeScript, TailwindCSS (No Web3/MetaMask dependency) |
| Blockchain | Polygon Amoy Testnet (or Base Sepolia) |
| Testing | Hardhat tests (Chai), Jest (backend), Vitest (frontend) |

### 1.4 Architecture Justification (Custodial vs. Non-Custodial)

This project implements a **Server-Managed (Custodial)** architecture.

*   **Rationale**: To provide a seamless "Web2-like" experience where users do not need to manage private keys or install browser extensions. This ensures the Proof of Concept is accessible and reliable in all testing environments.
*   **Business Value**:
    *   **Gas Abstraction**: Removing the need for users to hold ETH/MATIC significantly lowers the barrier to entry.
    *   **Compliance**: Centralized transaction signing allows for pre-chain KYC/AML checks.
    *   **Recovery**: Password resets are possible; Seed Phrase loss is not a catastrophic failure mode.
*   **Trade-off**: While this centralizes trust (the platform holds the keys) and liability, it eliminates the #1 friction point for blockchain adoption: onboarding.
*   **Comparison**:
    *   **Server-Managed**: Backend signs transactions. High UX, Trust-based.
    *   **Client-Side**: User signs via MetaMask. Low UX, Trustless.

---

## 2. Project Structure

Generate the following monorepo structure:

```
puente-poc/
├── README.md
├── package.json                    # Workspace root
├── .gitignore
├── .env.example
│
├── contracts/                      # Hardhat project
│   ├── package.json
│   ├── hardhat.config.ts
│   ├── tsconfig.json
│   ├── .env.example
│   ├── contracts/
│   │   ├── RemittanceEscrow.sol
│   │   └── mocks/
│   │       └── MockUSDC.sol
│   ├── scripts/
│   │   └── deploy.ts
│   ├── test/
│   │   └── RemittanceEscrow.test.ts
│   └── typechain-types/            # Auto-generated
│
├── backend/                        # NestJS project
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   │   └── configuration.ts
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   └── current-user.decorator.ts
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   └── filters/
│   │   │       └── http-exception.filter.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       └── login.dto.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── entities/
│   │   │       └── user.entity.ts
│   │   ├── remittances/
│   │   │   ├── remittances.module.ts
│   │   │   ├── remittances.controller.ts
│   │   │   ├── remittances.service.ts
│   │   │   ├── entities/
│   │   │   │   └── remittance.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-remittance.dto.ts
│   │   │       └── update-remittance.dto.ts
│   │   ├── blockchain/
│   │   │   ├── blockchain.module.ts
│   │   │   └── blockchain.service.ts
│   │   └── rates/
│   │       ├── rates.module.ts
│   │       ├── rates.controller.ts
│   │       └── rates.service.ts
│   └── test/
│       └── app.e2e-spec.ts
│
└── frontend/                       # React + Vite project
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── vite-env.d.ts
        ├── config/
        │   └── constants.ts
        ├── hooks/
        │   ├── useAuth.ts
        │   ├── useContract.ts
        │   └── useRemittances.ts
        ├── services/
        │   └── api.ts
        ├── components/
        │   ├── Layout.tsx
        │   ├── Navbar.tsx
        │   ├── ConnectWallet.tsx
        │   ├── RemittanceCard.tsx
        │   └── RemittanceForm.tsx
        ├── pages/
        │   ├── Login.tsx
        │   ├── Register.tsx
        │   ├── Dashboard.tsx
        │   └── NewRemittance.tsx
        ├── types/
        │   └── index.ts
        └── abis/
            └── RemittanceEscrow.json
```

---

## 3. Smart Contract Specification

### 3.1 RemittanceEscrow.sol

**File**: `contracts/contracts/RemittanceEscrow.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RemittanceEscrow
 * @notice Escrow contract for USDC remittances to Latin America
 * @dev Holds USDC until operator confirms off-chain delivery
 */
contract RemittanceEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- State Variables ---
    
    IERC20 public immutable usdc;
    
    enum Status { 
        Created,    // Remittance created, awaiting funding
        Funded,     // USDC deposited in escrow
        Completed,  // Off-chain delivery confirmed, funds released
        Refunded    // Funds returned to sender
    }
    
    struct Remittance {
        address sender;
        string recipientId;         // External recipient identifier (e.g., national ID)
        uint256 amountUSDC;         // Amount in USDC (6 decimals)
        uint256 targetAmountCOP;    // Expected COP amount for recipient
        uint256 exchangeRate;       // Rate at creation (COP per USD, 4 decimals)
        Status status;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 completedAt;
    }
    
    mapping(bytes32 => Remittance) public remittances;
    mapping(address => bytes32[]) public userRemittances;
    
    uint256 public remittanceCount;
    uint256 public constant REFUND_TIMEOUT = 7 days;
    
    // --- Events ---
    
    event RemittanceCreated(
        bytes32 indexed remittanceId,
        address indexed sender,
        string recipientId,
        uint256 amountUSDC,
        uint256 targetAmountCOP,
        uint256 exchangeRate
    );
    
    event RemittanceFunded(
        bytes32 indexed remittanceId,
        uint256 timestamp
    );
    
    event RemittanceCompleted(
        bytes32 indexed remittanceId,
        uint256 timestamp
    );
    
    event RemittanceRefunded(
        bytes32 indexed remittanceId,
        uint256 timestamp
    );

    // --- Constructor ---
    
    constructor(address _usdcAddress) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
    }

    // --- External Functions ---
    
    /**
     * @notice Create a new remittance
     * @param recipientId External identifier for the recipient
     * @param amountUSDC Amount in USDC (6 decimals)
     * @param exchangeRate COP per USD rate (4 decimals, e.g., 41500000 = 4150.0000)
     * @return remittanceId Unique identifier for the remittance
     */
    function createRemittance(
        string calldata recipientId,
        uint256 amountUSDC,
        uint256 exchangeRate
    ) external returns (bytes32 remittanceId) {
        require(bytes(recipientId).length > 0, "Invalid recipient ID");
        require(amountUSDC > 0, "Amount must be greater than 0");
        require(exchangeRate > 0, "Invalid exchange rate");
        
        remittanceCount++;
        remittanceId = keccak256(
            abi.encodePacked(
                msg.sender,
                recipientId,
                amountUSDC,
                block.timestamp,
                remittanceCount
            )
        );
        
        // Calculate target COP amount (USDC has 6 decimals, rate has 4 decimals)
        // Result: (amountUSDC * exchangeRate) / 10^4 = COP with 6 decimals
        // Then we adjust to 2 decimals for COP: / 10^4
        uint256 targetAmountCOP = (amountUSDC * exchangeRate) / 1e4;
        
        remittances[remittanceId] = Remittance({
            sender: msg.sender,
            recipientId: recipientId,
            amountUSDC: amountUSDC,
            targetAmountCOP: targetAmountCOP,
            exchangeRate: exchangeRate,
            status: Status.Created,
            createdAt: block.timestamp,
            fundedAt: 0,
            completedAt: 0
        });
        
        userRemittances[msg.sender].push(remittanceId);
        
        emit RemittanceCreated(
            remittanceId,
            msg.sender,
            recipientId,
            amountUSDC,
            targetAmountCOP,
            exchangeRate
        );
        
        return remittanceId;
    }
    
    /**
     * @notice Deposit USDC to fund a remittance
     * @dev Requires prior approval of USDC transfer
     * @param remittanceId The remittance to fund
     */
    function deposit(bytes32 remittanceId) external nonReentrant {
        Remittance storage rem = remittances[remittanceId];
        
        require(rem.sender == msg.sender, "Not the sender");
        require(rem.status == Status.Created, "Invalid status");
        
        rem.status = Status.Funded;
        rem.fundedAt = block.timestamp;
        
        usdc.safeTransferFrom(msg.sender, address(this), rem.amountUSDC);
        
        emit RemittanceFunded(remittanceId, block.timestamp);
    }
    
    /**
     * @notice Release funds after confirming off-chain delivery
     * @dev Only callable by contract owner (operator)
     * @param remittanceId The remittance to complete
     */
    function release(bytes32 remittanceId) external onlyOwner nonReentrant {
        Remittance storage rem = remittances[remittanceId];
        
        require(rem.status == Status.Funded, "Invalid status");
        
        rem.status = Status.Completed;
        rem.completedAt = block.timestamp;
        
        // In production, funds would go to a liquidity pool or treasury
        // For PoC, funds stay in contract (simulating settlement)
        
        emit RemittanceCompleted(remittanceId, block.timestamp);
    }
    
    /**
     * @notice Refund USDC to sender
     * @dev Callable by sender after timeout, or by owner anytime
     * @param remittanceId The remittance to refund
     */
    function refund(bytes32 remittanceId) external nonReentrant {
        Remittance storage rem = remittances[remittanceId];
        
        require(rem.status == Status.Funded, "Invalid status");
        
        bool isOwner = msg.sender == owner();
        bool isSenderAfterTimeout = (
            msg.sender == rem.sender && 
            block.timestamp >= rem.fundedAt + REFUND_TIMEOUT
        );
        
        require(isOwner || isSenderAfterTimeout, "Not authorized");
        
        rem.status = Status.Refunded;
        rem.completedAt = block.timestamp;
        
        usdc.safeTransfer(rem.sender, rem.amountUSDC);
        
        emit RemittanceRefunded(remittanceId, block.timestamp);
    }

    // --- View Functions ---
    
    /**
     * @notice Get remittance details
     */
    function getRemittance(bytes32 remittanceId) 
        external 
        view 
        returns (Remittance memory) 
    {
        return remittances[remittanceId];
    }
    
    /**
     * @notice Get all remittance IDs for a user
     */
    function getUserRemittances(address user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return userRemittances[user];
    }
    
    /**
     * @notice Get contract's USDC balance
     */
    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
```

### 3.2 MockUSDC.sol (for testing)

**File**: `contracts/contracts/mocks/MockUSDC.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing purposes
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals = 6;

    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000 * 10**_decimals); // 1M USDC
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens for testing
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Faucet function for testnet
     */
    function faucet() external {
        _mint(msg.sender, 1000 * 10**_decimals); // 1000 USDC
    }
}
```

### 3.3 Hardhat Configuration

**File**: `contracts/hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80002,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
    },
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
```

### 3.4 Deployment Script

**File**: `contracts/scripts/deploy.ts`

```typescript
import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  let usdcAddress: string;

  // Deploy MockUSDC on testnets, use real USDC on mainnet
  if (network.name === "hardhat" || network.name === "localhost") {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("MockUSDC deployed to:", usdcAddress);
  } else if (network.name === "polygonAmoy") {
    // Use testnet USDC or deploy mock
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("MockUSDC deployed to:", usdcAddress);
  } else {
    throw new Error("Configure USDC address for this network");
  }

  // Deploy RemittanceEscrow
  const RemittanceEscrow = await ethers.getContractFactory("RemittanceEscrow");
  const escrow = await RemittanceEscrow.deploy(usdcAddress);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log("RemittanceEscrow deployed to:", escrowAddress);

  // Output for frontend/backend config
  console.log("\n--- Configuration ---");
  console.log(`USDC_ADDRESS=${usdcAddress}`);
  console.log(`ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`CHAIN_ID=${network.config.chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### 3.5 Contract Tests

**File**: `contracts/test/RemittanceEscrow.test.ts`

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { RemittanceEscrow, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("RemittanceEscrow", function () {
  let escrow: RemittanceEscrow;
  let usdc: MockUSDC;
  let owner: SignerWithAddress;
  let sender: SignerWithAddress;
  let other: SignerWithAddress;

  const USDC_DECIMALS = 6;
  const AMOUNT = ethers.parseUnits("100", USDC_DECIMALS); // 100 USDC
  const EXCHANGE_RATE = 41500000; // 4150.0000 COP per USD
  const RECIPIENT_ID = "CC-123456789";

  beforeEach(async function () {
    [owner, sender, other] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // Deploy RemittanceEscrow
    const RemittanceEscrow = await ethers.getContractFactory("RemittanceEscrow");
    escrow = await RemittanceEscrow.deploy(await usdc.getAddress());

    // Fund sender with USDC
    await usdc.mint(sender.address, AMOUNT * 10n);
  });

  describe("createRemittance", function () {
    it("should create a remittance successfully", async function () {
      const tx = await escrow
        .connect(sender)
        .createRemittance(RECIPIENT_ID, AMOUNT, EXCHANGE_RATE);

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "RemittanceCreated"
      );
      
      expect(event).to.not.be.undefined;

      const remittanceId = escrow.interface.parseLog(event!)?.args.remittanceId;
      const remittance = await escrow.getRemittance(remittanceId);

      expect(remittance.sender).to.equal(sender.address);
      expect(remittance.recipientId).to.equal(RECIPIENT_ID);
      expect(remittance.amountUSDC).to.equal(AMOUNT);
      expect(remittance.status).to.equal(0); // Created
    });

    it("should reject zero amount", async function () {
      await expect(
        escrow.connect(sender).createRemittance(RECIPIENT_ID, 0, EXCHANGE_RATE)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should reject empty recipient ID", async function () {
      await expect(
        escrow.connect(sender).createRemittance("", AMOUNT, EXCHANGE_RATE)
      ).to.be.revertedWith("Invalid recipient ID");
    });
  });

  describe("deposit", function () {
    let remittanceId: string;

    beforeEach(async function () {
      const tx = await escrow
        .connect(sender)
        .createRemittance(RECIPIENT_ID, AMOUNT, EXCHANGE_RATE);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "RemittanceCreated"
      );
      remittanceId = escrow.interface.parseLog(event!)?.args.remittanceId;
    });

    it("should deposit USDC successfully", async function () {
      await usdc.connect(sender).approve(await escrow.getAddress(), AMOUNT);
      await escrow.connect(sender).deposit(remittanceId);

      const remittance = await escrow.getRemittance(remittanceId);
      expect(remittance.status).to.equal(1); // Funded

      const contractBalance = await escrow.getContractBalance();
      expect(contractBalance).to.equal(AMOUNT);
    });

    it("should reject deposit from non-sender", async function () {
      await usdc.mint(other.address, AMOUNT);
      await usdc.connect(other).approve(await escrow.getAddress(), AMOUNT);

      await expect(
        escrow.connect(other).deposit(remittanceId)
      ).to.be.revertedWith("Not the sender");
    });

    it("should reject double deposit", async function () {
      await usdc.connect(sender).approve(await escrow.getAddress(), AMOUNT * 2n);
      await escrow.connect(sender).deposit(remittanceId);

      await expect(
        escrow.connect(sender).deposit(remittanceId)
      ).to.be.revertedWith("Invalid status");
    });
  });

  describe("release", function () {
    let remittanceId: string;

    beforeEach(async function () {
      const tx = await escrow
        .connect(sender)
        .createRemittance(RECIPIENT_ID, AMOUNT, EXCHANGE_RATE);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "RemittanceCreated"
      );
      remittanceId = escrow.interface.parseLog(event!)?.args.remittanceId;

      await usdc.connect(sender).approve(await escrow.getAddress(), AMOUNT);
      await escrow.connect(sender).deposit(remittanceId);
    });

    it("should release successfully by owner", async function () {
      await escrow.connect(owner).release(remittanceId);

      const remittance = await escrow.getRemittance(remittanceId);
      expect(remittance.status).to.equal(2); // Completed
    });

    it("should reject release from non-owner", async function () {
      await expect(
        escrow.connect(sender).release(remittanceId)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  describe("refund", function () {
    let remittanceId: string;

    beforeEach(async function () {
      const tx = await escrow
        .connect(sender)
        .createRemittance(RECIPIENT_ID, AMOUNT, EXCHANGE_RATE);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log) => escrow.interface.parseLog(log)?.name === "RemittanceCreated"
      );
      remittanceId = escrow.interface.parseLog(event!)?.args.remittanceId;

      await usdc.connect(sender).approve(await escrow.getAddress(), AMOUNT);
      await escrow.connect(sender).deposit(remittanceId);
    });

    it("should refund by owner", async function () {
      const balanceBefore = await usdc.balanceOf(sender.address);
      await escrow.connect(owner).refund(remittanceId);
      const balanceAfter = await usdc.balanceOf(sender.address);

      expect(balanceAfter - balanceBefore).to.equal(AMOUNT);

      const remittance = await escrow.getRemittance(remittanceId);
      expect(remittance.status).to.equal(3); // Refunded
    });

    it("should refund by sender after timeout", async function () {
      // Advance time by 7 days
      await time.increase(7 * 24 * 60 * 60);

      await escrow.connect(sender).refund(remittanceId);

      const remittance = await escrow.getRemittance(remittanceId);
      expect(remittance.status).to.equal(3); // Refunded
    });

    it("should reject refund by sender before timeout", async function () {
      await expect(
        escrow.connect(sender).refund(remittanceId)
      ).to.be.revertedWith("Not authorized");
    });
  });
});
```

### 3.6 Contracts package.json

**File**: `contracts/package.json`

```json
{
  "name": "puente-contracts",
  "version": "1.0.0",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "test:coverage": "hardhat coverage",
    "deploy:local": "hardhat run scripts/deploy.ts --network localhost",
    "deploy:amoy": "hardhat run scripts/deploy.ts --network polygonAmoy",
    "node": "hardhat node"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@openzeppelin/contracts": "^5.0.0",
    "dotenv": "^16.3.1",
    "hardhat": "^2.19.0"
  }
}
```

### 3.7 Contracts .env.example

**File**: `contracts/.env.example`

```env
# Deployer private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# RPC URLs
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Block explorer API keys (for verification)
POLYGONSCAN_API_KEY=your_polygonscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
```

---

## 4. Backend Specification

### 4.1 Database Entities

#### User Entity

**File**: `backend/src/users/entities/user.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Remittance } from '../../remittances/entities/remittance.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  walletAddress: string;

  @Column({ length: 2, default: 'US' })
  countryCode: string;

  @Column({ default: false })
  isAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Remittance, (remittance) => remittance.sender)
  remittances: Remittance[];
}
```

#### Remittance Entity

**File**: `backend/src/remittances/entities/remittance.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RemittanceStatus {
  PENDING = 'pending',       // Created in DB, not yet on blockchain
  CREATED = 'created',       // Created on blockchain
  FUNDED = 'funded',         // USDC deposited
  COMPLETED = 'completed',   // Delivery confirmed
  REFUNDED = 'refunded',     // Funds returned
  FAILED = 'failed',         // Transaction failed
}

@Entity('remittances')
export class Remittance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User, (user) => user.remittances)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ nullable: true, unique: true })
  blockchainId: string; // bytes32 from contract

  @Column()
  recipientId: string; // External ID (e.g., national ID)

  @Column()
  recipientName: string;

  @Column({ type: 'decimal', precision: 18, scale: 6 })
  amountUsdc: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amountCop: number;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  exchangeRate: number;

  @Column({
    type: 'enum',
    enum: RemittanceStatus,
    default: RemittanceStatus.PENDING,
  })
  status: RemittanceStatus;

  @Column({ nullable: true })
  txHashCreate: string;

  @Column({ nullable: true })
  txHashFund: string;

  @Column({ nullable: true })
  txHashComplete: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  fundedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 4.2 DTOs

#### Create Remittance DTO

**File**: `backend/src/remittances/dto/create-remittance.dto.ts`

```typescript
import { IsString, IsNumber, IsPositive, MinLength, MaxLength } from 'class-validator';

export class CreateRemittanceDto {
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  recipientId: string; // e.g., "CC-123456789"

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipientName: string;

  @IsNumber()
  @IsPositive()
  amountUsdc: number; // e.g., 100.00
}
```

#### Update Remittance DTO

**File**: `backend/src/remittances/dto/update-remittance.dto.ts`

```typescript
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { RemittanceStatus } from '../entities/remittance.entity';

export class UpdateRemittanceDto {
  @IsOptional()
  @IsString()
  blockchainId?: string;

  @IsOptional()
  @IsString()
  txHashCreate?: string;

  @IsOptional()
  @IsString()
  txHashFund?: string;

  @IsOptional()
  @IsString()
  txHashComplete?: string;

  @IsOptional()
  @IsEnum(RemittanceStatus)
  status?: RemittanceStatus;
}
```

#### Auth DTOs

**File**: `backend/src/auth/dto/register.dto.ts`

```typescript
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  walletAddress?: string;
}
```

**File**: `backend/src/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

### 4.3 Services

#### Blockchain Service

**File**: `backend/src/blockchain/blockchain.service.ts`

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, Contract, Wallet, Provider } from 'ethers';

// Import ABI (copy from contracts/artifacts after compilation)
import * as RemittanceEscrowABI from '../abis/RemittanceEscrow.json';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: Provider;
  private wallet: Wallet;
  private escrowContract: Contract;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
    const privateKey = this.configService.get<string>('OPERATOR_PRIVATE_KEY');
    const escrowAddress = this.configService.get<string>('ESCROW_CONTRACT_ADDRESS');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.escrowContract = new ethers.Contract(
      escrowAddress,
      RemittanceEscrowABI.abi,
      this.wallet,
    );

    this.logger.log(`Connected to blockchain at ${rpcUrl}`);
    this.logger.log(`Escrow contract: ${escrowAddress}`);
  }

  /**
   * Get current exchange rate (mock for PoC)
   * In production, integrate with Chainlink or external API
   */
  async getExchangeRate(): Promise<number> {
    // Mock rate: 4150.0000 COP per USD
    // In production: fetch from oracle or external API
    return 4150.0;
  }

  /**
   * Get remittance details from blockchain
   */
  async getRemittance(remittanceId: string) {
    try {
      const result = await this.escrowContract.getRemittance(remittanceId);
      return {
        sender: result.sender,
        recipientId: result.recipientId,
        amountUSDC: ethers.formatUnits(result.amountUSDC, 6),
        targetAmountCOP: ethers.formatUnits(result.targetAmountCOP, 6),
        exchangeRate: Number(result.exchangeRate) / 10000,
        status: Number(result.status),
        createdAt: new Date(Number(result.createdAt) * 1000),
        fundedAt: result.fundedAt > 0 ? new Date(Number(result.fundedAt) * 1000) : null,
        completedAt: result.completedAt > 0 ? new Date(Number(result.completedAt) * 1000) : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get remittance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Release funds (mark remittance as completed)
   * Only callable by operator (contract owner)
   */
  async releaseRemittance(remittanceId: string): Promise<string> {
    try {
      const tx = await this.escrowContract.release(remittanceId);
      const receipt = await tx.wait();
      this.logger.log(`Released remittance ${remittanceId}, tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to release remittance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refund remittance
   */
  async refundRemittance(remittanceId: string): Promise<string> {
    try {
      const tx = await this.escrowContract.refund(remittanceId);
      const receipt = await tx.wait();
      this.logger.log(`Refunded remittance ${remittanceId}, tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      this.logger.error(`Failed to refund remittance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get USDC contract address
   */
  async getUsdcAddress(): Promise<string> {
    return await this.escrowContract.usdc();
  }

  /**
   * Get escrow contract address
   */
  getEscrowAddress(): string {
    return this.configService.get<string>('ESCROW_CONTRACT_ADDRESS');
  }
}
```

#### Remittances Service

**File**: `backend/src/remittances/remittances.service.ts`

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remittance, RemittanceStatus } from './entities/remittance.entity';
import { CreateRemittanceDto } from './dto/create-remittance.dto';
import { UpdateRemittanceDto } from './dto/update-remittance.dto';
import { BlockchainService } from '../blockchain/blockchain.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RemittancesService {
  constructor(
    @InjectRepository(Remittance)
    private remittanceRepository: Repository<Remittance>,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Create a new remittance
   */
  async create(user: User, dto: CreateRemittanceDto): Promise<Remittance> {
    const exchangeRate = await this.blockchainService.getExchangeRate();
    const amountCop = dto.amountUsdc * exchangeRate;

    const remittance = this.remittanceRepository.create({
      senderId: user.id,
      recipientId: dto.recipientId,
      recipientName: dto.recipientName,
      amountUsdc: dto.amountUsdc,
      amountCop,
      exchangeRate,
      status: RemittanceStatus.PENDING,
    });

    return this.remittanceRepository.save(remittance);
  }

  /**
   * Find all remittances for a user
   */
  async findAllByUser(userId: string): Promise<Remittance[]> {
    return this.remittanceRepository.find({
      where: { senderId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one remittance by ID
   */
  async findOne(id: string, userId: string): Promise<Remittance> {
    const remittance = await this.remittanceRepository.findOne({
      where: { id },
    });

    if (!remittance) {
      throw new NotFoundException('Remittance not found');
    }

    if (remittance.senderId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return remittance;
  }

  /**
   * Update remittance (after blockchain transactions)
   */
  async update(id: string, userId: string, dto: UpdateRemittanceDto): Promise<Remittance> {
    const remittance = await this.findOne(id, userId);

    Object.assign(remittance, dto);

    if (dto.status === RemittanceStatus.FUNDED) {
      remittance.fundedAt = new Date();
    }

    if (dto.status === RemittanceStatus.COMPLETED || dto.status === RemittanceStatus.REFUNDED) {
      remittance.completedAt = new Date();
    }

    return this.remittanceRepository.save(remittance);
  }

  /**
   * Admin: Complete a remittance (release funds)
   */
  async complete(id: string): Promise<Remittance> {
    const remittance = await this.remittanceRepository.findOne({ where: { id } });

    if (!remittance) {
      throw new NotFoundException('Remittance not found');
    }

    if (remittance.status !== RemittanceStatus.FUNDED) {
      throw new ForbiddenException('Remittance must be funded to complete');
    }

    const txHash = await this.blockchainService.releaseRemittance(remittance.blockchainId);

    remittance.status = RemittanceStatus.COMPLETED;
    remittance.txHashComplete = txHash;
    remittance.completedAt = new Date();

    return this.remittanceRepository.save(remittance);
  }

  /**
   * Admin: Refund a remittance
   */
  async refund(id: string): Promise<Remittance> {
    const remittance = await this.remittanceRepository.findOne({ where: { id } });

    if (!remittance) {
      throw new NotFoundException('Remittance not found');
    }

    if (remittance.status !== RemittanceStatus.FUNDED) {
      throw new ForbiddenException('Remittance must be funded to refund');
    }

    const txHash = await this.blockchainService.refundRemittance(remittance.blockchainId);

    remittance.status = RemittanceStatus.REFUNDED;
    remittance.txHashComplete = txHash;
    remittance.completedAt = new Date();

    return this.remittanceRepository.save(remittance);
  }

  /**
   * Get contract configuration for frontend
   */
  async getContractConfig() {
    const usdcAddress = await this.blockchainService.getUsdcAddress();
    const escrowAddress = this.blockchainService.getEscrowAddress();

    return {
      escrowAddress,
      usdcAddress,
      chainId: process.env.CHAIN_ID || '80002',
    };
  }
}
```

#### Rates Service

**File**: `backend/src/rates/rates.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';

export interface ExchangeRate {
  pair: string;
  rate: number;
  timestamp: Date;
}

@Injectable()
export class RatesService {
  constructor(private blockchainService: BlockchainService) {}

  /**
   * Get USD/COP exchange rate
   * In production, integrate with external API or Chainlink oracle
   */
  async getUsdCopRate(): Promise<ExchangeRate> {
    const rate = await this.blockchainService.getExchangeRate();

    return {
      pair: 'USD/COP',
      rate,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate COP amount from USD
   */
  async calculateCop(amountUsd: number): Promise<{ cop: number; rate: number }> {
    const { rate } = await this.getUsdCopRate();
    return {
      cop: amountUsd * rate,
      rate,
    };
  }
}
```

### 4.4 Controllers

#### Remittances Controller

**File**: `backend/src/remittances/remittances.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RemittancesService } from './remittances.service';
import { CreateRemittanceDto } from './dto/create-remittance.dto';
import { UpdateRemittanceDto } from './dto/update-remittance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('remittances')
@UseGuards(JwtAuthGuard)
export class RemittancesController {
  constructor(private readonly remittancesService: RemittancesService) {}

  /**
   * Create a new remittance
   */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateRemittanceDto) {
    return this.remittancesService.create(user, dto);
  }

  /**
   * Get all remittances for current user
   */
  @Get()
  findAll(@CurrentUser() user: User) {
    return this.remittancesService.findAllByUser(user.id);
  }

  /**
   * Get contract configuration
   */
  @Get('config')
  getConfig() {
    return this.remittancesService.getContractConfig();
  }

  /**
   * Get single remittance
   */
  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.remittancesService.findOne(id, user.id);
  }

  /**
   * Update remittance (after blockchain tx)
   */
  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRemittanceDto,
  ) {
    return this.remittancesService.update(id, user.id, dto);
  }

  /**
   * Admin: Complete remittance
   */
  @Post(':id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string) {
    // TODO: Add admin guard
    return this.remittancesService.complete(id);
  }

  /**
   * Admin: Refund remittance
   */
  @Post(':id/refund')
  refund(@Param('id', ParseUUIDPipe) id: string) {
    // TODO: Add admin guard
    return this.remittancesService.refund(id);
  }
}
```

#### Rates Controller

**File**: `backend/src/rates/rates.controller.ts`

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { RatesService } from './rates.service';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  /**
   * Get current USD/COP rate
   */
  @Get('usd-cop')
  getUsdCopRate() {
    return this.ratesService.getUsdCopRate();
  }

  /**
   * Calculate COP amount
   */
  @Get('calculate')
  calculate(@Query('amount') amount: string) {
    return this.ratesService.calculateCop(parseFloat(amount) || 0);
  }
}
```

#### Auth Controller

**File**: `backend/src/auth/auth.controller.ts`

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

### 4.5 Auth Service

**File**: `backend/src/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      walletAddress: dto.walletAddress,
    });

    await this.userRepository.save(user);

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
      },
      accessToken: token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
      },
      accessToken: token,
    };
  }

  private generateToken(user: User): string {
    const payload = { sub: user.id, email: user.email };
    return this.jwtService.sign(payload);
  }
}
```

### 4.6 Backend Configuration

**File**: `backend/src/config/configuration.ts`

```typescript
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'puente',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://rpc-amoy.polygon.technology',
    chainId: parseInt(process.env.CHAIN_ID, 10) || 80002,
    escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS,
    operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY,
  },
});
```

### 4.7 App Module

**File**: `backend/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RemittancesModule } from './remittances/remittances.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { RatesModule } from './rates/rates.module';
import { User } from './users/entities/user.entity';
import { Remittance } from './remittances/entities/remittance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        entities: [User, Remittance],
        synchronize: true, // Disable in production
      }),
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: { expiresIn: configService.get('jwt.expiresIn') },
      }),
      inject: [ConfigService],
      global: true,
    }),
    AuthModule,
    UsersModule,
    RemittancesModule,
    BlockchainModule,
    RatesModule,
  ],
})
export class AppModule {}
```

### 4.8 Backend package.json

**File**: `backend/package.json`

```json
{
  "name": "puente-backend",
  "version": "1.0.0",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.1.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "ethers": "^6.9.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.11.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "typeorm": "^0.3.17"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/bcrypt": "^5.0.2",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@types/passport-jwt": "^3.0.13",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.1.3"
  }
}
```

### 4.9 Docker Compose

**File**: `backend/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: puente-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: puente
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 4.10 Backend .env.example

**File**: `backend/.env.example`

```env
# Server
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=puente

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# Blockchain
BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
ESCROW_CONTRACT_ADDRESS=0x...
OPERATOR_PRIVATE_KEY=...
```

---

## 5. Frontend Specification

### 5.1 API Service

**File**: `frontend/src/services/api.ts`

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

// Auth
export const authApi = {
  register: (data: { email: string; password: string; walletAddress?: string }) =>
    api<{ user: User; accessToken: string }>('/auth/register', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    api<{ user: User; accessToken: string }>('/auth/login', { method: 'POST', body: data }),
};

// Rates
export const ratesApi = {
  getUsdCop: (token: string) =>
    api<{ pair: string; rate: number; timestamp: string }>('/rates/usd-cop', { token }),

  calculate: (amount: number, token: string) =>
    api<{ cop: number; rate: number }>(`/rates/calculate?amount=${amount}`, { token }),
};

// Remittances
export const remittancesApi = {
  getAll: (token: string) =>
    api<Remittance[]>('/remittances', { token }),

  getOne: (id: string, token: string) =>
    api<Remittance>(`/remittances/${id}`, { token }),

  create: (data: CreateRemittanceDto, token: string) =>
    api<Remittance>('/remittances', { method: 'POST', body: data, token }),

  update: (id: string, data: UpdateRemittanceDto, token: string) =>
    api<Remittance>(`/remittances/${id}`, { method: 'PATCH', body: data, token }),

  getConfig: (token: string) =>
    api<ContractConfig>('/remittances/config', { token }),
};

// Types
export interface User {
  id: string;
  email: string;
  walletAddress?: string;
}

export interface Remittance {
  id: string;
  blockchainId?: string;
  recipientId: string;
  recipientName: string;
  amountUsdc: number;
  amountCop: number;
  exchangeRate: number;
  status: string;
  txHashCreate?: string;
  txHashFund?: string;
  txHashComplete?: string;
  createdAt: string;
  fundedAt?: string;
  completedAt?: string;
}

export interface CreateRemittanceDto {
  recipientId: string;
  recipientName: string;
  amountUsdc: number;
}

export interface UpdateRemittanceDto {
  blockchainId?: string;
  txHashCreate?: string;
  txHashFund?: string;
  status?: string;
}

export interface ContractConfig {
  escrowAddress: string;
  usdcAddress: string;
  chainId: string;
}
```

### 5.2 Contract Hook

**File**: `frontend/src/hooks/useContract.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';
import RemittanceEscrowABI from '../abis/RemittanceEscrow.json';
import MockUsdcABI from '../abis/MockUSDC.json';

interface ContractConfig {
  escrowAddress: string;
  usdcAddress: string;
  chainId: string;
}

export function useContract(config: ContractConfig | null) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [escrowContract, setEscrowContract] = useState<Contract | null>(null);
  const [usdcContract, setUsdcContract] = useState<Contract | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect wallet
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed');
      return;
    }

    if (!config) {
      setError('Contract config not loaded');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.send('eth_requestAccounts', []);

      // Check network
      const network = await browserProvider.getNetwork();
      if (network.chainId !== BigInt(config.chainId)) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${parseInt(config.chainId).toString(16)}` }],
        });
      }

      const walletSigner = await browserProvider.getSigner();
      const walletAddress = await walletSigner.getAddress();

      const escrow = new Contract(
        config.escrowAddress,
        RemittanceEscrowABI.abi,
        walletSigner
      );

      const usdc = new Contract(
        config.usdcAddress,
        MockUsdcABI.abi,
        walletSigner
      );

      setProvider(browserProvider);
      setSigner(walletSigner);
      setAddress(walletAddress);
      setEscrowContract(escrow);
      setUsdcContract(usdc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [config]);

  // Disconnect
  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setEscrowContract(null);
    setUsdcContract(null);
  }, []);

  // Create remittance on chain
  const createRemittance = useCallback(
    async (recipientId: string, amountUsdc: number, exchangeRate: number) => {
      if (!escrowContract) throw new Error('Contract not connected');

      const amountWei = ethers.parseUnits(amountUsdc.toString(), 6);
      const rateScaled = Math.round(exchangeRate * 10000); // 4 decimals

      const tx = await escrowContract.createRemittance(recipientId, amountWei, rateScaled);
      const receipt = await tx.wait();

      // Find RemittanceCreated event
      const event = receipt.logs.find(
        (log: any) => escrowContract.interface.parseLog(log)?.name === 'RemittanceCreated'
      );

      const parsed = escrowContract.interface.parseLog(event);
      return {
        remittanceId: parsed?.args.remittanceId as string,
        txHash: receipt.hash as string,
      };
    },
    [escrowContract]
  );

  // Approve USDC spending
  const approveUsdc = useCallback(
    async (amount: number) => {
      if (!usdcContract || !config) throw new Error('Contract not connected');

      const amountWei = ethers.parseUnits(amount.toString(), 6);
      const tx = await usdcContract.approve(config.escrowAddress, amountWei);
      await tx.wait();
      return tx.hash;
    },
    [usdcContract, config]
  );

  // Deposit USDC to escrow
  const deposit = useCallback(
    async (remittanceId: string) => {
      if (!escrowContract) throw new Error('Contract not connected');

      const tx = await escrowContract.deposit(remittanceId);
      const receipt = await tx.wait();
      return receipt.hash;
    },
    [escrowContract]
  );

  // Get USDC balance
  const getUsdcBalance = useCallback(async () => {
    if (!usdcContract || !address) return '0';

    const balance = await usdcContract.balanceOf(address);
    return ethers.formatUnits(balance, 6);
  }, [usdcContract, address]);

  // Faucet (testnet only)
  const faucet = useCallback(async () => {
    if (!usdcContract) throw new Error('Contract not connected');

    const tx = await usdcContract.faucet();
    await tx.wait();
  }, [usdcContract]);

  return {
    address,
    isConnecting,
    error,
    connect,
    disconnect,
    createRemittance,
    approveUsdc,
    deposit,
    getUsdcBalance,
    faucet,
  };
}
```

### 5.3 Auth Hook

**File**: `frontend/src/hooks/useAuth.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { authApi, User } from '../services/api';

const TOKEN_KEY = 'puente_token';
const USER_KEY = 'puente_user';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const register = useCallback(
    async (email: string, password: string, walletAddress?: string) => {
      const result = await authApi.register({ email, password, walletAddress });

      localStorage.setItem(TOKEN_KEY, result.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));

      setToken(result.accessToken);
      setUser(result.user);

      return result;
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });

    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));

    setToken(result.accessToken);
    setUser(result.user);

    return result;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    register,
    login,
    logout,
  };
}
```

### 5.4 Main App Component

**File**: `frontend/src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewRemittance from './pages/NewRemittance';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="new" element={<NewRemittance />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 5.5 Dashboard Page

**File**: `frontend/src/pages/Dashboard.tsx`

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useContract } from '../hooks/useContract';
import { remittancesApi, Remittance, ContractConfig } from '../services/api';
import RemittanceCard from '../components/RemittanceCard';
import ConnectWallet from '../components/ConnectWallet';

export default function Dashboard() {
  const { token } = useAuth();
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);

  const contract = useContract(config);

  // Load config and remittances
  useEffect(() => {
    async function load() {
      if (!token) return;

      try {
        const [remittancesData, configData] = await Promise.all([
          remittancesApi.getAll(token),
          remittancesApi.getConfig(token),
        ]);

        setRemittances(remittancesData);
        setConfig(configData);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  // Load balance when connected
  useEffect(() => {
    if (contract.address) {
      contract.getUsdcBalance().then(setBalance);
    }
  }, [contract.address]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          to="/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          New Remittance
        </Link>
      </div>

      {/* Wallet Connection */}
      <div className="bg-white rounded-lg shadow p-4">
        <ConnectWallet
          address={contract.address}
          balance={balance}
          onConnect={contract.connect}
          onDisconnect={contract.disconnect}
          onFaucet={contract.faucet}
          isConnecting={contract.isConnecting}
          error={contract.error}
        />
      </div>

      {/* Remittances List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Remittances</h2>

        {remittances.length === 0 ? (
          <p className="text-gray-500">No remittances yet. Create your first one!</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {remittances.map((remittance) => (
              <RemittanceCard
                key={remittance.id}
                remittance={remittance}
                contract={contract}
                token={token!}
                onUpdate={(updated) =>
                  setRemittances((prev) =>
                    prev.map((r) => (r.id === updated.id ? updated : r))
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.6 New Remittance Page

**File**: `frontend/src/pages/NewRemittance.tsx`

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useContract } from '../hooks/useContract';
import { remittancesApi, ratesApi, ContractConfig } from '../services/api';

export default function NewRemittance() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState<ContractConfig | null>(null);
  const contract = useContract(config);

  const [recipientId, setRecipientId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amountUsdc, setAmountUsdc] = useState('');
  const [rate, setRate] = useState<number>(0);
  const [amountCop, setAmountCop] = useState<number>(0);
  const [step, setStep] = useState<'form' | 'confirm' | 'processing'>('form');
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string>('');

  // Load config and rate
  useEffect(() => {
    async function load() {
      if (!token) return;

      const [configData, rateData] = await Promise.all([
        remittancesApi.getConfig(token),
        ratesApi.getUsdCop(token),
      ]);

      setConfig(configData);
      setRate(rateData.rate);
    }

    load();
  }, [token]);

  // Calculate COP amount
  useEffect(() => {
    const usd = parseFloat(amountUsdc) || 0;
    setAmountCop(usd * rate);
  }, [amountUsdc, rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!contract.address) {
      setError('Please connect your wallet first');
      return;
    }

    setStep('processing');
    setError(null);

    try {
      // 1. Create in database
      setTxStatus('Creating remittance...');
      const remittance = await remittancesApi.create(
        {
          recipientId,
          recipientName,
          amountUsdc: parseFloat(amountUsdc),
        },
        token!
      );

      // 2. Create on blockchain
      setTxStatus('Creating on blockchain...');
      const { remittanceId, txHash } = await contract.createRemittance(
        recipientId,
        parseFloat(amountUsdc),
        rate
      );

      // 3. Update database with blockchain ID
      await remittancesApi.update(
        remittance.id,
        {
          blockchainId: remittanceId,
          txHashCreate: txHash,
          status: 'created',
        },
        token!
      );

      // 4. Approve USDC
      setTxStatus('Approving USDC...');
      await contract.approveUsdc(parseFloat(amountUsdc));

      // 5. Deposit
      setTxStatus('Depositing USDC...');
      const depositTxHash = await contract.deposit(remittanceId);

      // 6. Update database
      await remittancesApi.update(
        remittance.id,
        {
          txHashFund: depositTxHash,
          status: 'funded',
        },
        token!
      );

      setTxStatus('Complete!');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('form');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Remittance</h1>

      {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Recipient ID</label>
            <input
              type="text"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="CC-123456789"
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Recipient Name</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="María García"
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Amount (USDC)</label>
            <input
              type="number"
              value={amountUsdc}
              onChange={(e) => setAmountUsdc(e.target.value)}
              placeholder="100"
              min="1"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span>Exchange Rate:</span>
              <span>{rate.toLocaleString()} COP/USD</span>
            </div>
            <div className="flex justify-between font-semibold mt-2">
              <span>Recipient gets:</span>
              <span>{amountCop.toLocaleString()} COP</span>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Continue
          </button>
        </form>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p><strong>To:</strong> {recipientName} ({recipientId})</p>
            <p><strong>Amount:</strong> {amountUsdc} USDC</p>
            <p><strong>They receive:</strong> {amountCop.toLocaleString()} COP</p>
            <p><strong>Rate:</strong> {rate.toLocaleString()} COP/USD</p>
          </div>

          {!contract.address && (
            <button
              onClick={contract.connect}
              className="w-full bg-orange-500 text-white py-2 rounded-lg"
            >
              Connect Wallet to Continue
            </button>
          )}

          {contract.address && (
            <div className="flex gap-2">
              <button
                onClick={() => setStep('form')}
                className="flex-1 border py-2 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg"
              >
                Confirm & Send
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>{txStatus}</p>
        </div>
      )}
    </div>
  );
}
```

### 5.7 Frontend package.json

**File**: `frontend/package.json`

```json
{
  "name": "puente-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "ethers": "^6.9.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

### 5.8 Frontend .env.example

**File**: `frontend/.env.example`

```env
VITE_API_URL=http://localhost:3000
```

---

## 6. Additional Components

### 6.1 ConnectWallet Component

**File**: `frontend/src/components/ConnectWallet.tsx`

```typescript
interface Props {
  address: string | null;
  balance: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onFaucet: () => void;
  isConnecting: boolean;
  error: string | null;
}

export default function ConnectWallet({
  address,
  balance,
  onConnect,
  onDisconnect,
  onFaucet,
  isConnecting,
  error,
}: Props) {
  if (!address) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-gray-600">Wallet not connected</span>
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
        {error && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-mono text-sm">
          {address.slice(0, 6)}...{address.slice(-4)}
        </p>
        <p className="text-sm text-gray-600">Balance: {balance} USDC</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onFaucet}
          className="text-blue-600 text-sm hover:underline"
        >
          Get Test USDC
        </button>
        <button
          onClick={onDisconnect}
          className="text-red-600 text-sm hover:underline"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
```

### 6.2 RemittanceCard Component

**File**: `frontend/src/components/RemittanceCard.tsx`

```typescript
import { Remittance, remittancesApi } from '../services/api';

interface Props {
  remittance: Remittance;
  contract: ReturnType<typeof import('../hooks/useContract').useContract>;
  token: string;
  onUpdate: (updated: Remittance) => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  created: 'bg-yellow-100 text-yellow-800',
  funded: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  refunded: 'bg-red-100 text-red-800',
};

export default function RemittanceCard({ remittance, contract, token, onUpdate }: Props) {
  const handleFund = async () => {
    if (!contract.address || !remittance.blockchainId) return;

    try {
      await contract.approveUsdc(remittance.amountUsdc);
      const txHash = await contract.deposit(remittance.blockchainId);

      const updated = await remittancesApi.update(
        remittance.id,
        { txHashFund: txHash, status: 'funded' },
        token
      );
      onUpdate(updated);
    } catch (err) {
      console.error('Failed to fund:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold">{remittance.recipientName}</p>
          <p className="text-sm text-gray-500">{remittance.recipientId}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs ${statusColors[remittance.status]}`}>
          {remittance.status}
        </span>
      </div>

      <div className="text-sm space-y-1">
        <p>
          <span className="text-gray-500">Amount:</span> {remittance.amountUsdc} USDC →{' '}
          {remittance.amountCop.toLocaleString()} COP
        </p>
        <p>
          <span className="text-gray-500">Rate:</span> {remittance.exchangeRate} COP/USD
        </p>
        <p>
          <span className="text-gray-500">Created:</span>{' '}
          {new Date(remittance.createdAt).toLocaleDateString()}
        </p>
      </div>

      {remittance.status === 'created' && contract.address && (
        <button
          onClick={handleFund}
          className="mt-3 w-full bg-blue-600 text-white py-1 rounded text-sm"
        >
          Fund Remittance
        </button>
      )}

      {remittance.txHashFund && (
        <a
          href={`https://amoy.polygonscan.com/tx/${remittance.txHashFund}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline mt-2 block"
        >
          View on Explorer
        </a>
      )}
    </div>
  );
}
```

---

## 7. Setup Instructions

### 7.1 Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- MetaMask browser extension
- Testnet MATIC for gas (Polygon Amoy faucet)

### 7.2 Installation Steps

```bash
# 1. Clone and install dependencies
git clone <repo>
cd puente-poc

# Install all workspaces
npm install

# 2. Start PostgreSQL
cd backend
docker-compose up -d
cd ..

# 3. Configure environment files
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Compile and deploy contracts
cd contracts
npm run compile
npm run deploy:amoy  # Note the addresses output
cd ..

# 5. Update backend/.env with contract addresses
# ESCROW_CONTRACT_ADDRESS=0x...

# 6. Start backend
cd backend
npm run start:dev
cd ..

# 7. Copy ABI to frontend
cp contracts/artifacts/contracts/RemittanceEscrow.sol/RemittanceEscrow.json frontend/src/abis/
cp contracts/artifacts/contracts/mocks/MockUSDC.sol/MockUSDC.json frontend/src/abis/

# 8. Start frontend
cd frontend
npm run dev
```

### 7.3 Testing Flow

1. Open http://localhost:5173
2. Register a new account
3. Connect MetaMask (switch to Polygon Amoy)
4. Click "Get Test USDC" to mint test tokens
5. Create a new remittance
6. Approve and fund the remittance
7. (Admin) Call POST /remittances/:id/complete to simulate delivery

---

## 8. Acceptance Criteria

| # | Criteria | How to Verify |
|---|----------|---------------|
| 1 | Smart contract deploys successfully | Contract address on Polygonscan |
| 2 | User can register and login | JWT token returned |
| 3 | User can connect MetaMask | Address displayed in UI |
| 4 | User can create remittance | Record in DB + blockchain event |
| 5 | User can fund remittance | USDC transferred to escrow |
| 6 | Admin can complete remittance | Status changes to "completed" |
| 7 | Full E2E flow works | All steps 1-6 complete |

---

## 9. Notes for LLM Code Generation

When generating this codebase:

1. **Start with contracts/** — compile and test before moving on
2. **Generate backend/** next — ensure DB connection works
3. **Generate frontend/** last — needs ABIs from contracts
4. **Use exact versions** specified in package.json files
5. **Don't skip type definitions** — TypeScript strict mode
6. **Test each layer** before integrating
7. **Copy ABIs** from contracts/artifacts to frontend/src/abis after compilation

### Common Issues to Avoid

- Missing `reflect-metadata` import in NestJS main.ts
- Forgetting to add entities to TypeORM configuration
- Using ethers v5 syntax with ethers v6
- Not handling BigInt serialization in JSON responses
- Missing CORS configuration in NestJS

---

**End of Specification**

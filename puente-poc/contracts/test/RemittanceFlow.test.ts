import { expect } from "chai";
import { ethers } from "hardhat";
import { RemittanceEscrow, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Remittance Status Flow Sequence", function () {
    let escrow: RemittanceEscrow;
    let usdc: MockUSDC;
    let owner: SignerWithAddress;
    let sender: SignerWithAddress;
    let recipient_account: SignerWithAddress; // Not used on-chain but good for clarity

    const USDC_DECIMALS = 6;
    const AMOUNT = ethers.parseUnits("100", USDC_DECIMALS);
    const EXCHANGE_RATE = 41500000;
    const RECIPIENT_ID = "CC-FLOW-TEST";

    // Status Enum mapping
    enum Status {
        Created = 0,
        Funded = 1,
        Completed = 2,
        Refunded = 3
    }

    before(async function () {
        [owner, sender, recipient_account] = await ethers.getSigners();

        // 1. Deploy Contracts
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.deploy();

        const RemittanceEscrow = await ethers.getContractFactory("RemittanceEscrow");
        escrow = await RemittanceEscrow.deploy(await usdc.getAddress());

        // 2. Setup: Mint tokens to sender
        await usdc.mint(sender.address, AMOUNT * 10n);
    });

    it("should follow the successful Create -> Fund -> Release sequence", async function () {
        // --- STEP 1: CREATE ---
        const createTx = await escrow
            .connect(sender)
            .createRemittance(RECIPIENT_ID, AMOUNT, EXCHANGE_RATE);

        const createReceipt = await createTx.wait();
        const createEvent = createReceipt?.logs.find(
            (log) => escrow.interface.parseLog(log)?.name === "RemittanceCreated"
        );
        const remittanceId = escrow.interface.parseLog(createEvent!)?.args.remittanceId;

        // Verify Status: CREATED (0)
        let remittance = await escrow.getRemittance(remittanceId);
        expect(remittance.status).to.equal(Status.Created);
        console.log("Step 1: Remittance Created. Status:", remittance.status);


        // --- STEP 2: FUND ---
        // Approve first
        await usdc.connect(sender).approve(await escrow.getAddress(), AMOUNT);

        // Deposit
        const fundTx = await escrow.connect(sender).deposit(remittanceId);
        await fundTx.wait();

        // Verify Status: FUNDED (1)
        remittance = await escrow.getRemittance(remittanceId);
        expect(remittance.status).to.equal(Status.Funded);
        console.log("Step 2: Remittance Funded. Status:", remittance.status);


        // --- STEP 3: RELEASE (Complete) ---
        // Release by Owner (Operator)
        const releaseTx = await escrow.connect(owner).release(remittanceId);
        await releaseTx.wait();

        // Verify Status: COMPLETED (2)
        remittance = await escrow.getRemittance(remittanceId);
        expect(remittance.status).to.equal(Status.Completed);
        console.log("Step 3: Remittance Released. Status:", remittance.status);
    });
});

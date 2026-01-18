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

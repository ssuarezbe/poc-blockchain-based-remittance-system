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

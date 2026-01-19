import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, Contract, Wallet, JsonRpcProvider } from 'ethers';

// Import ABI
import * as RemittanceEscrowABI from '../abis/RemittanceEscrow.json';
import * as MockUSDCABI from '../abis/MockUSDC.json';

@Injectable()
export class BlockchainService implements OnModuleInit {
    private readonly logger = new Logger(BlockchainService.name);
    private provider: JsonRpcProvider;
    private wallet: Wallet;
    private escrowContract: Contract;
    private usdcContract: Contract;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        const rpcUrl = this.configService.get<string>('blockchain.rpcUrl');
        const privateKey = this.configService.get<string>('blockchain.operatorPrivateKey');
        const escrowAddress = this.configService.get<string>('blockchain.escrowAddress');
        const usdcAddress = this.configService.get<string>('blockchain.usdcAddress');

        if (!privateKey || !escrowAddress || !usdcAddress) {
            this.logger.warn('Blockchain config missing (private key, escrow, or usdc). Blockchain features disabled.');
            return;
        }

        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.escrowContract = new ethers.Contract(
            escrowAddress,
            RemittanceEscrowABI.abi,
            this.wallet,
        );
        this.usdcContract = new ethers.Contract(
            usdcAddress,
            MockUSDCABI.abi,
            this.wallet,
        );

        this.logger.log(`Connected to blockchain at ${rpcUrl}`);
        this.logger.log(`Escrow contract: ${escrowAddress}`);
    }

    /**
     * Create Remittance On-Chain (Server Signed)
     * @param recipientId Identifier for recipient
     * @param amountUsdc Amount in USDC
     * @param exchangeRate Exchange rate
     */
    async createRemittanceOnChain(recipientId: string, amountUsdc: number, exchangeRate: number): Promise<{ remittanceId: string, txHash: string }> {
        try {
            const amountWei = ethers.parseUnits(amountUsdc.toString(), 6);
            const rateScaled = Math.round(exchangeRate * 10000);

            this.logger.log(`Creating remittance for ${recipientId} with amount ${amountUsdc} USDC`);
            const tx = await this.escrowContract.createRemittance(recipientId, amountWei, rateScaled);
            const receipt = await tx.wait();

            // Find RemittanceCreated event
            const event = receipt.logs.find(
                (log: any) => {
                    try {
                        return this.escrowContract.interface.parseLog(log)?.name === 'RemittanceCreated';
                    } catch (e) { return false; }
                }
            );

            if (!event) throw new Error('RemittanceCreated event not found');

            const parsed = this.escrowContract.interface.parseLog(event);

            this.logger.log(`Created remittance on-chain: ${parsed.args.remittanceId}`);
            return {
                remittanceId: parsed.args.remittanceId,
                txHash: receipt.hash,
            };
        } catch (error) {
            this.logger.error(`Failed to create remittance on-chain: ${error.message}`);
            throw error;
        }
    }

    /**
     * Approve and Deposit Funds (Server Signed)
     * @param remittanceId Blockchain ID of the remittance
     * @param amountUsdc Amount to deposit
     */
    async approveAndDeposit(remittanceId: string, amountUsdc: number): Promise<string> {
        try {
            const amountWei = ethers.parseUnits(amountUsdc.toString(), 6);
            const escrowAddr = await this.escrowContract.getAddress();

            // Explicitly manage nonces to avoid "Nonce too low" errors with fast local mining
            let nonce = await this.provider.getTransactionCount(this.wallet.address);

            // 1. Approve
            this.logger.log(`Approving ${amountUsdc} USDC for escrow (nonce: ${nonce})...`);
            const approveTx = await this.usdcContract.approve(escrowAddr, amountWei, { nonce });
            await approveTx.wait();

            // Increment nonce for the next transaction
            nonce++;

            // 2. Deposit
            this.logger.log(`Depositing for remittance ${remittanceId} (nonce: ${nonce})...`);
            const depositTx = await this.escrowContract.deposit(remittanceId, { nonce });
            const receipt = await depositTx.wait();

            this.logger.log(`Deposited funds, tx: ${receipt.hash}`);
            return receipt.hash;
        } catch (error) {
            this.logger.error(`Failed to deposit funds: ${error.message}`);
            throw error;
        }
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
        if (!this.escrowContract) return '';
        return await this.escrowContract.usdc();
    }

    /**
     * Get escrow contract address
     */
    getEscrowAddress(): string {
        return this.configService.get<string>('blockchain.escrowAddress');
    }
}

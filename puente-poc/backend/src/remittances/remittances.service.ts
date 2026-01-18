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
    ) { }

    /**
     * Create a new remittance
     */
    async create(user: User, dto: CreateRemittanceDto): Promise<Remittance> {
        const exchangeRate = await this.blockchainService.getExchangeRate();
        const amountCop = dto.amountUsdc * exchangeRate;

        // 1. Create on Db
        const remittance = this.remittanceRepository.create({
            senderId: user.id,
            recipientId: dto.recipientId,
            recipientName: dto.recipientName,
            amountUsdc: dto.amountUsdc,
            amountCop,
            exchangeRate,
            status: RemittanceStatus.PENDING,
            logs: [{
                action: 'init',
                timestamp: new Date().toISOString(),
                details: { amount: dto.amountUsdc, recipient: dto.recipientId }
            }]
        });

        try {
            // 2. Create on Blockchain (Server Signed)
            const { remittanceId, txHash } = await this.blockchainService.createRemittanceOnChain(
                dto.recipientId,
                dto.amountUsdc,
                exchangeRate
            );

            remittance.blockchainId = remittanceId;
            remittance.txHashCreate = txHash;
            remittance.logs.push({
                action: 'create_on_chain',
                timestamp: new Date().toISOString(),
                details: { txHash, remittanceId }
            });

            return this.remittanceRepository.save(remittance);
        } catch (error) {
            remittance.status = RemittanceStatus.FAILED;
            remittance.logs.push({
                action: 'create_failed',
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack
            });
            await this.remittanceRepository.save(remittance);
            throw error;
        }
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

    /**
     * Fund remittance (Server Signed)
     */
    async fund(id: string, userId: string): Promise<Remittance> {
        const remittance = await this.findOne(id, userId);

        if (remittance.status !== RemittanceStatus.PENDING) {
            throw new ForbiddenException('Remittance already funded or cancelled');
        }

        // Execute chain tx
        const txHash = await this.blockchainService.approveAndDeposit(remittance.blockchainId, remittance.amountUsdc);

        remittance.status = RemittanceStatus.FUNDED;
        remittance.txHashFund = txHash;
        remittance.fundedAt = new Date();

        return this.remittanceRepository.save(remittance);
    }

    /**
     * Admin: Get all remittances with full details
     */
    async findAllAdmin(): Promise<Remittance[]> {
        return this.remittanceRepository.find({
            order: { createdAt: 'DESC' },
            relations: ['sender'],
        });
    }
}

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

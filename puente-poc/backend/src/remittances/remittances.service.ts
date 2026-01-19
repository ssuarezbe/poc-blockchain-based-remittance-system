import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remittance, RemittanceStatus } from './entities/remittance.entity';
import { CreateRemittanceDto } from './dto/create-remittance.dto';
import { UpdateRemittanceDto } from './dto/update-remittance.dto';
import { BlockchainService } from '../blockchain/blockchain.service';
import { User } from '../users/entities/user.entity';
import * as crypto from 'crypto';
import { ReceivedRemittance } from './entities/received-remittance.entity';
import { RatesService } from '../rates/rates.service';

@Injectable()
export class RemittancesService {
    private readonly logger = new Logger(RemittancesService.name);

    constructor(
        @InjectRepository(Remittance)
        private remittanceRepository: Repository<Remittance>,
        @InjectRepository(ReceivedRemittance)
        private receivedRemittanceRepository: Repository<ReceivedRemittance>,
        private blockchainService: BlockchainService,
        private ratesService: RatesService,
    ) { }

    private addLog(remittance: Remittance, action: string, details?: any, error?: any) {
        if (!remittance.logs) {
            remittance.logs = [];
        }

        const prevEvent = remittance.logs.length > 0 ? remittance.logs[remittance.logs.length - 1] : null;

        const newLog = {
            eventId: crypto.randomUUID(),
            prevEventId: prevEvent ? prevEvent.eventId : null,
            action,
            timestamp: new Date().toISOString(), // UTC by default
            details,
            error: error?.message,
            stack: error?.stack,
            trace: new Error().stack, // Capture trace for all events as requested
        };

        remittance.logs.push(newLog);
    }

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
            logs: []
        });

        this.addLog(remittance, 'init', { amount: dto.amountUsdc, recipient: dto.recipientId });

        try {
            // 2. Create on Blockchain (Server Signed)
            const { remittanceId, txHash } = await this.blockchainService.createRemittanceOnChain(
                dto.recipientId,
                dto.amountUsdc,
                exchangeRate
            );

            remittance.blockchainId = remittanceId;
            remittance.txHashCreate = txHash;

            this.addLog(remittance, 'create_on_chain', { txHash, remittanceId });
            remittance.status = RemittanceStatus.CREATED;

            return this.remittanceRepository.save(remittance);
        } catch (error) {
            remittance.status = RemittanceStatus.FAILED;
            this.addLog(remittance, 'create_failed', null, error);
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
    async findOne(id: string, userId?: string): Promise<Remittance> {
        const remittance = await this.remittanceRepository.findOne({
            where: { id },
        });

        if (!remittance) {
            throw new NotFoundException('Remittance not found');
        }

        if (userId && remittance.senderId !== userId) {
            throw new ForbiddenException('Access denied');
        }

        return remittance;
    }

    /**
     * Update remittance (after blockchain transactions)
     */
    async update(id: string, userId: string | undefined, dto: UpdateRemittanceDto): Promise<Remittance> {
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
    async release(id: string): Promise<Remittance> {
        const remittance = await this.findOne(id);
        if (remittance.status !== RemittanceStatus.FUNDED) {
            throw new BadRequestException(`Remittance must be FUNDED to release. Current status: ${remittance.status}`);
        }

        this.addLog(remittance, 'release_init');

        try {
            // Server-Managed Release (Admin triggered)
            const txHash = await this.blockchainService.releaseRemittance(remittance.blockchainId);

            remittance.status = RemittanceStatus.COMPLETED;
            remittance.completedAt = new Date();
            remittance.txHashComplete = txHash;
            this.addLog(remittance, 'release_success', { txHash });

            return this.remittanceRepository.save(remittance);
        } catch (error) {
            this.addLog(remittance, 'release_failed', null, error);
            await this.remittanceRepository.save(remittance);
            throw error;
        }
    }

    async receive(id: string, metadata: { ip: string, ua: string }): Promise<Remittance> {
        const remittance = await this.findOne(id);

        if (remittance.status !== RemittanceStatus.FUNDED) {
            throw new BadRequestException(`Remittance is not ready to be received. Status: ${remittance.status}`);
        }

        this.addLog(remittance, 'receive_init', metadata);

        try {
            // 1. Execute Blockchain Release (Server-Managed)
            // Ideally, this should be "claim" on contract if the receiver was signing, 
            // but in this Server-Managed flow, "receiving" triggers the release.
            const txHash = await this.blockchainService.releaseRemittance(remittance.blockchainId);

            // 2. Create Received Record
            const receivedRecord = this.receivedRemittanceRepository.create({
                remittance,
                ipAddress: metadata.ip,
                userAgent: metadata.ua
            });
            await this.receivedRemittanceRepository.save(receivedRecord);

            // 3. Update Main Record
            remittance.status = RemittanceStatus.COMPLETED;
            remittance.completedAt = new Date();
            remittance.txHashComplete = txHash;
            this.addLog(remittance, 'receive_success', { txHash, receivedId: receivedRecord.id });

            return this.remittanceRepository.save(remittance);
        } catch (error) {
            this.addLog(remittance, 'receive_failed', null, error);
            await this.remittanceRepository.save(remittance);
            throw error;
        }
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

        try {
            const txHash = await this.blockchainService.refundRemittance(remittance.blockchainId);

            remittance.status = RemittanceStatus.REFUNDED;
            remittance.txHashComplete = txHash;
            remittance.completedAt = new Date();

            this.addLog(remittance, 'refunded', { txHash });

            return this.remittanceRepository.save(remittance);
        } catch (error) {
            this.addLog(remittance, 'refund_failed', null, error);
            await this.remittanceRepository.save(remittance);
            throw error;
        }
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
    async fund(id: string, userId?: string): Promise<Remittance> {
        const remittance = await this.findOne(id, userId);

        if (remittance.status !== RemittanceStatus.PENDING && remittance.status !== RemittanceStatus.CREATED) {
            // Allow funding if PENDING (db only) or CREATED (db+chain)
            // Ideally it should be CREATED, but if they are stuck in PENDING... 
            // Actually, create sets it to CREATED now.
            // Let's loosen to allow if not final state.
            if (remittance.status === RemittanceStatus.COMPLETED || remittance.status === RemittanceStatus.REFUNDED)
                throw new ForbiddenException('Remittance already finalized');
        }

        try {
            // Execute chain tx
            const txHash = await this.blockchainService.approveAndDeposit(remittance.blockchainId, remittance.amountUsdc);

            remittance.status = RemittanceStatus.FUNDED;
            remittance.txHashFund = txHash;
            remittance.fundedAt = new Date();

            this.addLog(remittance, 'funded', { txHash });

            return this.remittanceRepository.save(remittance);
        } catch (error) {
            this.addLog(remittance, 'fund_failed', null, error);
            await this.remittanceRepository.save(remittance);
            // Don't change status to failed if just fund failed? User can retry.
            // But log the error.
            throw error;
        }
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

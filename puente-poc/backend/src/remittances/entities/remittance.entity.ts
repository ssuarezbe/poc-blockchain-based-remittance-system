import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity';

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

    @ManyToOne('User', (user: User) => user.remittances)
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

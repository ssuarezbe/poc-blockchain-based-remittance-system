import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Remittance } from './remittance.entity';

@Entity('received_remittances')
export class ReceivedRemittance {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    remittanceId: string;

    @ManyToOne(() => Remittance)
    @JoinColumn({ name: 'remittanceId' })
    remittance: Remittance;

    @CreateDateColumn()
    receivedAt: Date;

    @Column({ nullable: true })
    ipAddress: string;

    @Column({ nullable: true })
    userAgent: string;
}

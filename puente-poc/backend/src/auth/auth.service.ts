import { Injectable, UnauthorizedException, ConflictException, OnModuleInit, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService,
    ) { }

    async onModuleInit() {
        const defaultEmail = 'default@example.com';
        const existing = await this.userRepository.findOne({ where: { email: defaultEmail } });

        if (!existing) {
            this.logger.log(`Seeding default user: ${defaultEmail}`);
            await this.register({
                email: defaultEmail,
                password: 'defa-key-2026$',
                walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Example address (Hardhat #1)
            });
        }
    }

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

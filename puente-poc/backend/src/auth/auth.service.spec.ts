import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
    let service: AuthService;
    let mockUserRepository;
    let mockJwtService;

    beforeEach(async () => {
        mockUserRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        mockJwtService = {
            sign: jest.fn(() => 'mock-token'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('register', () => {
        it('should register a new user', async () => {
            const dto = { email: 'test@example.com', password: 'password123' };
            const savedUser = { id: 'uuid', ...dto, passwordHash: 'hashed' };

            mockUserRepository.findOne.mockResolvedValue(null);
            mockUserRepository.create.mockReturnValue(savedUser);
            mockUserRepository.save.mockResolvedValue(savedUser);

            const result = await service.register(dto);

            expect(mockUserRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                email: dto.email,
            }));
            expect(result).toHaveProperty('accessToken', 'mock-token');
            expect(result.user).toHaveProperty('email', 'test@example.com');
        });

        it('should throw if email exists', async () => {
            const dto = { email: 'test@example.com', password: 'password123' };
            mockUserRepository.findOne.mockResolvedValue({ id: 'uuid' });

            await expect(service.register(dto)).rejects.toThrow('Email already registered');
        });
    });
});

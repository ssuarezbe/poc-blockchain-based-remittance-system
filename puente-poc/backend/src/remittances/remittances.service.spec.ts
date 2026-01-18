import { Test, TestingModule } from '@nestjs/testing';
import { RemittancesService } from './remittances.service';
import { Remittance } from './entities/remittance.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';

describe('RemittancesService', () => {
    let service: RemittancesService;
    let mockRemittanceRepository;
    let mockBlockchainService;

    const mockUser = { id: 'user-uuid' } as User;

    beforeEach(async () => {
        mockRemittanceRepository = {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
        };

        mockBlockchainService = {
            getExchangeRate: jest.fn(() => 4000.0),
            createRemittanceOnChain: jest.fn().mockResolvedValue({
                remittanceId: '123',
                txHash: '0xabc'
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RemittancesService,
                {
                    provide: getRepositoryToken(Remittance),
                    useValue: mockRemittanceRepository,
                },
                {
                    provide: BlockchainService,
                    useValue: mockBlockchainService,
                },
            ],
        }).compile();

        service = module.get<RemittancesService>(RemittancesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a remittance with calculated rate', async () => {
            const dto = {
                recipientId: '123',
                recipientName: 'Test Recipient',
                amountUsdc: 100,
            };

            const expectedCop = 100 * 4000;

            mockRemittanceRepository.create.mockImplementation((data) => data);
            mockRemittanceRepository.save.mockImplementation((data) => Promise.resolve({ id: 'remittance-id', ...data }));

            const result = await service.create(mockUser, dto);

            expect(mockBlockchainService.getExchangeRate).toHaveBeenCalled();
            expect(result.amountCop).toBe(expectedCop);
            expect(result.exchangeRate).toBe(4000.0);
            expect(result.senderId).toBe(mockUser.id);
        });
    });
});

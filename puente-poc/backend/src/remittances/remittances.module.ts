import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemittancesService } from './remittances.service';
import { RemittancesController } from './remittances.controller';
import { Remittance } from './entities/remittance.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Remittance]),
        BlockchainModule,
    ],
    controllers: [RemittancesController],
    providers: [RemittancesService],
})
export class RemittancesModule { }

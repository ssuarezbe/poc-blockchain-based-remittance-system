import { Module } from '@nestjs/common';
import { RemittancesService } from './remittances.service';
import { RemittancesController } from './remittances.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remittance } from './entities/remittance.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RatesModule } from '../rates/rates.module';
import { ReceivedRemittance } from './entities/received-remittance.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Remittance, ReceivedRemittance]),
        BlockchainModule,
        RatesModule,
    ],
    controllers: [RemittancesController],
    providers: [RemittancesService],
})
export class RemittancesModule { }

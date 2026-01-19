import { Module } from '@nestjs/common';
import { RatesService } from './rates.service';
import { RatesController } from './rates.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
    imports: [BlockchainModule],
    controllers: [RatesController],
    providers: [RatesService],
    exports: [RatesService],
})
export class RatesModule { }

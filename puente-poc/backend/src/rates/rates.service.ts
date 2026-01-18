import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';

export interface ExchangeRate {
    pair: string;
    rate: number;
    timestamp: Date;
}

@Injectable()
export class RatesService {
    constructor(private blockchainService: BlockchainService) { }

    /**
     * Get USD/COP exchange rate
     * In production, integrate with external API or Chainlink oracle
     */
    async getUsdCopRate(): Promise<ExchangeRate> {
        const rate = await this.blockchainService.getExchangeRate();

        return {
            pair: 'USD/COP',
            rate,
            timestamp: new Date(),
        };
    }

    /**
     * Calculate COP amount from USD
     */
    async calculateCop(amountUsd: number): Promise<{ cop: number; rate: number }> {
        const { rate } = await this.getUsdCopRate();
        return {
            cop: amountUsd * rate,
            rate,
        };
    }
}

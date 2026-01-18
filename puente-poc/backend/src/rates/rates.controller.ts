import { Controller, Get, Query } from '@nestjs/common';
import { RatesService } from './rates.service';

@Controller('rates')
export class RatesController {
    constructor(private readonly ratesService: RatesService) { }

    /**
     * Get current USD/COP rate
     */
    @Get('usd-cop')
    getUsdCopRate() {
        return this.ratesService.getUsdCopRate();
    }

    /**
     * Calculate COP amount
     */
    @Get('calculate')
    calculate(@Query('amount') amount: string) {
        return this.ratesService.calculateCop(parseFloat(amount) || 0);
    }
}

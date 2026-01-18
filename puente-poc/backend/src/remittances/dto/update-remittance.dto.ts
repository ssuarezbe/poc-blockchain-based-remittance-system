import { IsString, IsOptional, IsEnum } from 'class-validator';
import { RemittanceStatus } from '../entities/remittance.entity';

export class UpdateRemittanceDto {
    @IsOptional()
    @IsString()
    blockchainId?: string;

    @IsOptional()
    @IsString()
    txHashCreate?: string;

    @IsOptional()
    @IsString()
    txHashFund?: string;

    @IsOptional()
    @IsString()
    txHashComplete?: string;

    @IsOptional()
    @IsEnum(RemittanceStatus)
    status?: RemittanceStatus;
}

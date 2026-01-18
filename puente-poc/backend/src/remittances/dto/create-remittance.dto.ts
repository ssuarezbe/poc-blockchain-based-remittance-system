import { IsString, IsNumber, IsPositive, MinLength, MaxLength } from 'class-validator';

export class CreateRemittanceDto {
    @IsString()
    @MinLength(5)
    @MaxLength(50)
    recipientId: string; // e.g., "CC-123456789"

    @IsString()
    @MinLength(2)
    @MaxLength(100)
    recipientName: string;

    @IsNumber()
    @IsPositive()
    amountUsdc: number; // e.g., 100.00
}

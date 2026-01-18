import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { RemittancesService } from './remittances.service';
import { CreateRemittanceDto } from './dto/create-remittance.dto';
import { UpdateRemittanceDto } from './dto/update-remittance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('remittances')
@UseGuards(JwtAuthGuard)
export class RemittancesController {
    constructor(private readonly remittancesService: RemittancesService) { }

    /**
     * Create a new remittance
     */
    @Post()
    create(@CurrentUser() user: User, @Body() dto: CreateRemittanceDto) {
        return this.remittancesService.create(user, dto);
    }

    /**
     * Get all remittances for current user
     */
    @Get()
    findAll(@CurrentUser() user: User) {
        return this.remittancesService.findAllByUser(user.id);
    }

    /**
     * Get contract configuration
     */
    @Get('config')
    getConfig() {
        return this.remittancesService.getContractConfig();
    }

    /**
     * Get single remittance
     */
    @Get(':id')
    findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
        return this.remittancesService.findOne(id, user.id);
    }

    /**
     * Update remittance (after blockchain tx)
     */
    @Patch(':id')
    update(
        @CurrentUser() user: User,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateRemittanceDto,
    ) {
        return this.remittancesService.update(id, user.id, dto);
    }

    /**
     * Admin: Complete remittance
     */
    @Post(':id/complete')
    complete(@Param('id', ParseUUIDPipe) id: string) {
        // TODO: Add admin guard
        return this.remittancesService.complete(id);
    }

    /**
     * Admin: Refund remittance
     */
    @Post(':id/refund')
    refund(@Param('id', ParseUUIDPipe) id: string) {
        // TODO: Add admin guard
        return this.remittancesService.refund(id);
    }

    /**
     * Admin: Get all remittances
     */
    @Get('admin/all')
    findAllAdmin() {
        return this.remittancesService.findAllAdmin();
    }

    /**
     * Fund a remittance (User action)
     */
    @Post(':id/fund')
    fund(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
        return this.remittancesService.fund(id, user.id);
    }
}

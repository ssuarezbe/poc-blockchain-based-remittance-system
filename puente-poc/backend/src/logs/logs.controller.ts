import { Controller, Post, Body, Logger } from '@nestjs/common';

@Controller('logs')
export class LogsController {
    private readonly logger = new Logger(LogsController.name);

    @Post()
    log(@Body() body: any) {
        const { message, level = 'error', details } = body;
        const logData = {
            source: 'CLIENT',
            details,
            timestamp: new Date().toISOString(),
        };

        const logMsg = `[CLIENT] ${message} | Details: ${JSON.stringify(logData)}`;

        if (level === 'error') {
            this.logger.error(logMsg);
        } else if (level === 'warn') {
            this.logger.warn(logMsg);
        } else {
            this.logger.log(logMsg);
        }

        return { received: true };
    }
}

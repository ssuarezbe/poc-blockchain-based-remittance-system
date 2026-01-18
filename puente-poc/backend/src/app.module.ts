import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RemittancesModule } from './remittances/remittances.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { RatesModule } from './rates/rates.module';
import { User } from './users/entities/user.entity';
import { Remittance } from './remittances/entities/remittance.entity';
import { LogsController } from './logs/logs.controller';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('database.host'),
                port: configService.get('database.port'),
                username: configService.get('database.username'),
                password: configService.get('database.password'),
                database: configService.get('database.database'),
                entities: [User, Remittance],
                synchronize: true, // Disable in production
            }),
            inject: [ConfigService],
        }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('jwt.secret'),
                signOptions: { expiresIn: configService.get('jwt.expiresIn') },
            }),
            inject: [ConfigService],
            global: true,
        }),
        AuthModule,
        UsersModule,
        RemittancesModule,
        BlockchainModule,
        RatesModule,
    ],
    controllers: [AppController, LogsController],
})
export class AppModule { }

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from 'utils/entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forFeature([Order]),
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 4000,
        },
      },
      {
        name: 'NOTIFICATION_SERVICE',  
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 6000, // Adjust as needed
        },
      },
    ]),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],   
})
export class OrderModule {}
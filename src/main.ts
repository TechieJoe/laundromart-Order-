import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: 'shinkansen.proxy.rlwy.net',
        port: 53609,
      },
    },
  );

  console.log(`📡 Connected to Order Microservice via TCP (shinkansen.proxy.rlwy.net:53609)`);
  await app.listen();
}
bootstrap(); 




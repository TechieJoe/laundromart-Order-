import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { CreateOrderDto } from 'utils/dto';

@Controller()
export class OrderController {
  private readonly logger = new Logger(OrderController.name);
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern({ cmd: 'create_order' })
  async createOrder(@Payload() data: { dto: CreateOrderDto; token: string }) {
    console.log(data)
    const { dto, token } = data;
    this.logger.log(`📩 Received create_order: ${JSON.stringify(dto)}`);

    return this.orderService.createOrder(dto, token);
  }

  @MessagePattern({ cmd: 'get_orders' })
  async getOrders(@Payload() data: { token: string }) {
    this.logger.log(`Received get_orders for ${data.token}`);
    return this.orderService.getOrders( data.token);
  }

    /**
     * 
     Test
  @MessagePattern({ cmd: 'verify_transaction' })
  async verifyTransaction(@Payload() data: { reference: string }) {
    this.logger.log(`Received verify_transaction for ${data.reference}`);
    return this.orderService.verifyTransaction(data.reference);
  }

  */

  @MessagePattern({ cmd: 'verify_payment' })
  async verifyPayment(reference: string) {
    return this.orderService.verifyTransaction(reference);
  }
    /**

  @MessagePattern({ cmd: 'handle_webhook' })
  async handleWebhook(@Payload() data: { event: any }) {
    this.logger.log(`Received webhook event`);
    return this.orderService.handleWebhookEvent(data.event);
  }
    */


  @MessagePattern({ cmd: 'paystack-webhook' })
  async handleWebhook(@Payload() payload: any) {
    this.logger.log(`Received webhook payload for reference: ${payload?.data?.reference}`);
    return this.orderService.processWebhook(payload);
  }
}

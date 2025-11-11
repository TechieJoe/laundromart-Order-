import { Injectable, HttpException, HttpStatus, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as crypto from 'crypto';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Order } from 'utils/entity';
import { CreateOrderDto } from 'utils/dto';


@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  private readonly paystackBaseUrl = 'https://api.paystack.co';

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @Inject('NOTIFICATION_SERVICE') private notificationClient: ClientProxy,
    @Inject('AUTH_SERVICE') private authClient: ClientProxy,
  ) {}

  /**
   * Validate the JWT with Auth microservice
   */
  private async validateUser(token: string) {
    try {
      const res = await lastValueFrom(
        this.authClient.send({ cmd: 'verify_token' }, { token }),
      );
      if (!res || res.error) return null;
      return { userId: res.userId, email: res.email, name: res.name };
    } catch (err) {
      this.logger.error('Auth verification error', err);
      return null;
    }
  }

  /**
   * Create order and return Paystack URL
   */
  async createOrder(dto: CreateOrderDto, token: string) {
    const user = await this.validateUser(token); // verify_token via Auth microservice
    if (!user) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    // Enrich DTO (frontend already computed grandTotal & totals)
    dto.userId = user.userId;
    dto.email = user.email;
    dto.orderId = dto.orderId || crypto.randomUUID();
    dto.reference = dto.reference || crypto.randomBytes(16).toString('hex');

    // Quick validation: ensure totals look valid
    if (!dto.orders?.length || !dto.grandTotal || dto.grandTotal <= 0) {
      throw new HttpException('Invalid order totals', HttpStatus.BAD_REQUEST);
    }

    // Save to Postgres
    const newOrder = this.orderRepository.create({
      userId: dto.userId,
      orderId: dto.orderId,
      reference: dto.reference,
      orders: dto.orders,
      grandTotal: dto.grandTotal,
      metadata: dto.metadata || {},
      status: 'pending',
      email: dto.email,
    });
    const saved = await this.orderRepository.save(newOrder);

    console.log(saved)

    // Initialize Paystack
    const paystackUrl = await this.initializeTransaction(saved);

    return {
      authorizationUrl: paystackUrl,
      orderId: saved.orderId,
      reference: saved.reference,
      order: saved,
    };
  }

  /**
   * Initialize Paystack transaction
   */
  async initializeTransaction(savedOrder: Order) {
    try {
      const response = await axios.post(
        `${this.paystackBaseUrl}/transaction/initialize`,
        {
          email: savedOrder.email,
          amount: Number(savedOrder.grandTotal) * 100, // convert to kobo
          reference: savedOrder.reference,
          callback_url: process.env.PAYSTACK_CALLBACK_URL,
          metadata: {
            sourceApp: 'laundromart',
            userId: savedOrder.userId,
            orderId: savedOrder.orderId,
          },
        },
        { headers: { Authorization: `Bearer ${this.paystackSecretKey}` } },
      );

      if (response.data?.status) {
        this.logger.log(`✅ Paystack init success for ref=${savedOrder.reference}`);
        return response.data.data.authorization_url;
      }

      this.logger.error('❌ Paystack init failed', response.data);
      throw new HttpException('Failed to initialize transaction', HttpStatus.BAD_REQUEST);
    } catch (err) {
      this.logger.error('Paystack init error', err?.response?.data || err.message);
      throw new HttpException('Failed to initialize transaction', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Verify Paystack transaction(test)
   
  async verifyTransaction(reference: string) {
    try {
      const response = await axios.get(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        { headers: { Authorization: `Bearer ${this.paystackSecretKey}` } },
      );
      const status = response.data?.data?.status;
      if (status === 'success') {
        await this.orderRepository.update({ reference }, { status: 'successful' });
      }
      return response.data;
    } catch (err) {
      this.logger.error('verifyTransaction error', err);
      throw new HttpException('Failed to verify transaction', HttpStatus.BAD_REQUEST);
    }
  }
    */

async verifyTransaction(reference: string) {
  const response = await axios.get(
    `${this.paystackBaseUrl}/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${this.paystackSecretKey}` },
    },
  );

  const payment = response.data?.data;

  if (!payment) return { status: false };

  if (payment.status === 'success') {
    await this.orderRepository.update(
      { reference },
      { status: 'successful'},
    );

    return { status: true, data: payment }; // ✅ Standard success return
  }

  await this.orderRepository.update(
    { reference },
    { status: 'failed' },
  );

  return { status: false, data: payment }; // ❌ Standard fail return
}

/**
   * Handle Paystack webhook
  async handleWebhookEvent(event: any) {
    const reference = event?.data?.reference;
    if (!reference) throw new HttpException('Invalid webhook payload', HttpStatus.BAD_REQUEST);

    await this.orderRepository.update({ reference }, { status: 'successful' });
    this.logger.log(`Webhook processed for ${reference}`);
  }
   
    */


   async processWebhook(payload: any) {
    try {
      const reference = payload?.data?.reference;
      const status = payload?.data?.status;

      if (!reference || !status) {
        this.logger.warn('Invalid webhook payload');
        return { success: false, message: 'Invalid payload' };
      }

      if (status === 'success') {
        await this.orderRepository.update(
          { reference },
          { status: 'successful' },
        );
      } else if (status === 'failed') {
        await this.orderRepository.update({ reference }, { status: 'failed' });
      }

      this.logger.log(`Processed webhook for ${reference}: ${status}`);
      return { success: true };
    } catch (err) {
      this.logger.error('Webhook processing failed', err);
      return { success: false, error: err.message };
    }
  }
  /**
   * Get orders for a user
   */
   async getOrders(token: string) {
  const user = await this.validateUser(token);
  if (!user || !user.userId) {
    throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
  }

  const orders = await this.orderRepository.find({
    where: { userId: user.userId },
    order: { createdAt: 'DESC' },
  });

  // ✅ Build structured notifications from orders
  const notifications = orders.map(order => ({
    message: `Your order (${order.orderId || order.reference}) was ${order.status || 'processed'}.`,
    status: order.status || 'completed',
    createdAt: order.createdAt,
    metadata: {
      orders: order.orders || [],
      grandTotal: order.grandTotal || 0,
    },
  }));

  return notifications;
  } 

}

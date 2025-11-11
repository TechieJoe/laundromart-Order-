import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ActionDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;
}

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  item: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  action: ActionDto[];

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsOptional()
  total?: number; // service will compute this
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orders: OrderItemDto[];

  @IsNumber()
  @IsOptional()
  grandTotal?: number; // service will compute this

  @IsOptional()
  metadata?: Record<string, any>;

  // The following are intentionally optional: gateway/client does not send these.
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsOptional()
  @IsString()
  status?: string; // 
  
}

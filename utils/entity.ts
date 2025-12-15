import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  orderId: string;   // You can store as duplicate of id or business id

  @Column()
  reference: string;

  @Column('jsonb')
  orders: Array<{
    item: string;
    action: Array<{ type: string; price: number }>;
    quantity: number;
    total: number;
  }>;

  @Column('decimal', { precision: 12, scale: 2 })
  grandTotal: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  email: string;
 
  @CreateDateColumn()
  createdAt: Date;
}

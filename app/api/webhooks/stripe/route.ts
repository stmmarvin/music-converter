import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { pool } from '@/app/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Ongeldige handtekening' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription as string;

    if (userId && subscriptionId) {
      await pool.execute(
        'INSERT INTO subscriptions (user_id, stripe_subscription_id, status) VALUES (?, ?, ?)',
        [userId, subscriptionId, 'active']
      );
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    await pool.execute(
      'UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?',
      ['canceled', subscription.id]
    );
  }

  return NextResponse.json({ received: true });
}
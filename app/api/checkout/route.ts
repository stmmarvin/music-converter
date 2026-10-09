import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { pool } from '@/app/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    const [rows]: any = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 });
    }

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await pool.execute('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?payment=cancelled`,
      metadata: {
        userId: String(userId),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout fout:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Sessie kon niet worden gestart' }, { status: 500 });
  }
}
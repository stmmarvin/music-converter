import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { pool } from '@/app/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Vul alle velden in' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result]: any = await pool.execute(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashedPassword]
    );

    return NextResponse.json({ message: 'Gebruiker aangemaakt', userId: result.insertId });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'E-mailadres bestaat al' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Registratie mislukt' }, { status: 500 });
  }
}
'use server';

import { z } from 'zod';
import { query } from '@/lib/db';
import { hashPassword, comparePassword, signJWT } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validation = loginSchema.safeParse({ email, password });
  if (!validation.success) {
    return { success: false, errors: validation.error.flatten().fieldErrors };
  }

  try {
    const users = await query<any>(
      'SELECT id, name, email, password_hash, role, status FROM odoo_assetflow_users WHERE email = ?',
      [email]
    );
    const user = users[0];

    if (!user || user.status === 'INACTIVE') {
      return { success: false, message: 'Invalid email or password' };
    }

    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return { success: false, message: 'Invalid email or password' };
    }

    const token = await signJWT({ id: user.id, email: user.email, role: user.role });

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'An unexpected error occurred. Please try again.' };
  }

  redirect('/dashboard');
}

export async function signup(prevState: any, formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const validation = signupSchema.safeParse({ name, email, password });
  if (!validation.success) {
    return { success: false, errors: validation.error.flatten().fieldErrors };
  }

  try {
    const existingUsers = await query<any>('SELECT id FROM odoo_assetflow_users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return { success: false, message: 'Email address already registered' };
    }

    const hashedPassword = await hashPassword(password);
    const id = crypto.randomUUID();

    // Signup ALWAYS yields EMPLOYEE role (no privilege escalation!)
    await query(
      'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, 'EMPLOYEE', 'ACTIVE']
    );

    const token = await signJWT({ id, email, role: 'EMPLOYEE' });

    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, message: 'An unexpected error occurred. Please try again.' };
  }

  redirect('/dashboard');
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  redirect('/login');
}

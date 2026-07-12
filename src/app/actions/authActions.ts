'use server';

import { z } from 'zod';
import { query } from '@/lib/db';
import { hashPassword, comparePassword, signJWT } from '@/lib/auth';
import { sendEmail } from '@/lib/mail';
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

// 4. Request Password Reset Code
export async function requestPasswordResetCode(email: string) {
  try {
    const users = await query<any>(
      'SELECT id, name FROM odoo_assetflow_users WHERE email = ? AND status = "ACTIVE"',
      [email.trim().toLowerCase()]
    );
    const user = users[0];

    if (!user) {
      // For security, return success even if user not found to avoid user enumeration
      return { success: true, message: 'If a matching active account exists, a reset code was sent.' };
    }

    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await query(
      'UPDATE odoo_assetflow_users SET reset_code = ?, reset_code_expires_at = ? WHERE id = ?',
      [resetCode, expiresAt, user.id]
    );

    // Send code via email
    const emailResult = await sendEmail({
      to: email.trim().toLowerCase(),
      subject: 'Reset your AssetFlow password',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg: 10px;">
          <h2 style="color: #0d9488; text-align: center;">AssetFlow Password Recovery</h2>
          <p>Hello ${user.name},</p>
          <p>We received a request to reset your password. Use the verification code below to proceed:</p>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #0f172a; border-radius: 5px; margin: 20px 0;">
            ${resetCode}
          </div>
          <p style="font-size: 12px; color: #64748b; text-align: center;">
            This code will expire in 15 minutes. If you did not make this request, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (!emailResult.success) {
      throw new Error('Failed to send verification email');
    }

    return { success: true, message: 'Verification code sent to your email.' };
  } catch (error: any) {
    console.error('Request password reset error:', error);
    return { success: false, message: error.message || 'Failed to request reset code' };
  }
}

// 5. Verify Reset Code and Update Password
export async function verifyCodeAndResetPassword(email: string, code: string, password: z.infer<typeof loginSchema>['password']) {
  if (password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters.' };
  }

  try {
    const users = await query<any>(
      'SELECT id, reset_code, reset_code_expires_at FROM odoo_assetflow_users WHERE email = ? AND status = "ACTIVE"',
      [email.trim().toLowerCase()]
    );
    const user = users[0];

    if (!user) {
      return { success: false, message: 'Invalid email or request expired.' };
    }

    if (!user.reset_code || user.reset_code !== code.trim()) {
      return { success: false, message: 'Invalid verification code.' };
    }

    const expiresAt = new Date(user.reset_code_expires_at);
    if (expiresAt.getTime() < Date.now()) {
      return { success: false, message: 'Verification code has expired.' };
    }

    // Update password hash and clear reset code columns
    const hashedPassword = await hashPassword(password);
    await query(
      'UPDATE odoo_assetflow_users SET password_hash = ?, reset_code = NULL, reset_code_expires_at = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    return { success: true, message: 'Password reset successful! You can now log in.' };
  } catch (error: any) {
    console.error('Verify reset code error:', error);
    return { success: false, message: 'Failed to reset password. Please try again.' };
  }
}

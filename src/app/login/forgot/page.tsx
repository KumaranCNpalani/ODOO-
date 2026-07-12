'use client';

import { useState, useTransition } from 'react';
import { requestPasswordResetCode, verifyCodeAndResetPassword } from '@/app/actions/authActions';
import Link from 'next/link';
import { Mail, ShieldCheck, KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setMessage(null);

    startTransition(async () => {
      const result = await requestPasswordResetCode(email);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        setStep(2);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to send reset code' });
      }
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code || !newPassword) return;
    setMessage(null);

    startTransition(async () => {
      const result = await verifyCodeAndResetPassword(email, code, newPassword);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        // Redirect or reset form
        setStep(1);
        setEmail('');
        setCode('');
        setNewPassword('');
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to reset password' });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative colored glow orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-primary/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[300px] h-[300px] rounded-full bg-amber-500/10 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-xl p-8 relative glass-card">
        {/* Branding header */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <div className="w-24 h-16 relative">
            <Image
              src="/logo.png"
              alt="AssetFlow Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">AssetFlow</h2>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Password Recovery
          </p>
        </div>

        {message && (
          <div className={`p-3.5 rounded-lg border text-xs font-semibold text-center mb-5 animate-pulse-slow ${
            message.type === 'success' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}>
            {message.text}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground leading-relaxed text-center mb-2">
              Enter your email address below. We'll send you a 6-digit verification code to reset your password.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
              <div className="flex items-center gap-2.5 bg-secondary border border-border/60 px-3 rounded-lg focus-within:border-primary transition-all">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 py-3 bg-transparent text-foreground text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Code...
                </>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground leading-relaxed text-center mb-2">
              A code has been sent to <strong>{email}</strong>. Enter the code and your new password.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">6-Digit Code</label>
              <div className="flex items-center gap-2.5 bg-secondary border border-border/60 px-3 rounded-lg focus-within:border-primary transition-all">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 py-3 bg-transparent text-foreground text-sm focus:outline-none placeholder:text-muted-foreground tracking-widest font-bold"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">New Password</label>
              <div className="flex items-center gap-2.5 bg-secondary border border-border/60 px-3 rounded-lg focus-within:border-primary transition-all">
                <KeyRound className="w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 py-3 bg-transparent text-foreground text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-lg bg-primary hover:bg-primary/95 text-white font-semibold text-sm transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full py-2.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              Resend verification email
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-border/60 pt-4">
          <Link
            href="/login"
            className="text-xs font-bold text-primary hover:text-primary/80 flex items-center justify-center gap-1 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

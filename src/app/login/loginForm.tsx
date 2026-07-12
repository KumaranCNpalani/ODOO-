'use client';

import { useState, useActionState } from 'react';
import { login, signup } from '@/app/actions/authActions';
import Link from 'next/link';
import logoImg from '@/app/logo.png';

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginState, loginAction, isLoginPending] = useActionState(login, null);
  const [signupState, signupAction, isSignupPending] = useActionState(signup, null);

  const errors = isLogin ? loginState?.errors : signupState?.errors;
  const message = isLogin ? loginState?.message : signupState?.message;
  const pending = isLogin ? isLoginPending : isSignupPending;

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass-panel border border-border shadow-2xl relative overflow-hidden">
      {/* Decorative backdrop glow */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col items-center gap-2 mb-6 relative z-10">
        <div className="w-24 h-16 relative">
          <img
            src={logoImg.src}
            alt="AssetFlow Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h2 className="text-2xl font-bold text-foreground mt-3">
          {isLogin ? 'Welcome to AssetFlow' : 'Create an Account'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isLogin ? 'Enter credentials to log in' : 'Sign up to register as an Employee'}
        </p>
      </div>

      {message && (
        <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold text-center animate-pulse-slow">
          {message}
        </div>
      )}

      <form action={isLogin ? loginAction : signupAction} className="flex flex-col gap-4 relative z-10">
        {!isLogin && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. John Doe"
              className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200"
            />
            {!isLogin && signupState?.errors?.name && (
              <span className="text-[10px] text-destructive font-semibold">{signupState.errors.name[0]}</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
          <input
            type="email"
            name="email"
            required
            placeholder="name@company.com"
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200"
          />
          {errors?.email && (
            <span className="text-[10px] text-destructive font-semibold">{errors.email[0]}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Password</label>
          </div>
          <input
            type="password"
            name="password"
            required
            placeholder="********"
            className="px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:border-primary transition-all duration-200"
          />
          {errors?.password && (
            <span className="text-[10px] text-destructive font-semibold">{errors.password[0]}</span>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 mt-4 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-lg shadow-primary/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-border/50 text-center relative z-10">
        <p className="text-xs text-muted-foreground">
          {isLogin ? "New here? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              if (loginState) loginState.message = '';
              if (signupState) signupState.message = '';
            }}
            className="text-primary hover:underline font-bold cursor-pointer"
          >
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </p>

        {!isLogin && (
          <p className="text-[10px] text-muted-foreground/80 mt-4 leading-relaxed max-w-[280px] mx-auto">
            ℹ️ Signup automatically creates an <strong>Employee</strong> account. Roles (Admin, Asset Manager, Dept Head) must be promoted by an Admin.
          </p>
        )}
      </div>
    </div>
  );
}

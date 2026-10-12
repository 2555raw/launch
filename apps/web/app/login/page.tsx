'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import type { AuthUser } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';
import { AuthCard, Divider, Field } from '@/components/auth/auth-card';
import { WalletSignInOptions } from '@/components/auth/wallet-buttons';
import { fieldErrors, isValidationError } from '@/components/ui/api-errors';
import { Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

type SessionBody = { user: AuthUser; accessToken: string; refreshToken?: string; expiresIn: number };

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) router.replace('/village');
  }, [ready, user, router]);

  const login = useMutation({
    mutationFn: () => api<SessionBody>('/auth/login', { method: 'POST', json: { email: email.trim(), password } }),
    onSuccess: (body) => {
      useAuth.getState().setSession(body);
      toast.success(t('Welcome back, {name}', { name: body.user.username }));
      router.push('/village');
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      setFormError(isValidationError(e) ? t('Please check the highlighted fields.') : errorMessage(e));
    },
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setErrors({});
    setFormError(null);
    login.mutate();
  };

  return (
    <AuthCard
      title={t('Sign in')}
      subtitle={t('Return to your hold. Your village kept producing while you were away.')}
      footer={
        <>
          {t('New here?')}{' '}
          <Link href="/register" className="font-semibold text-ember-300 hover:text-ember-200">
            {t('Create an account')}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{formError}</div>}
        <Field label={t('Email')} error={errors.email}>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label={t('Password')} error={errors.password}>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </Field>
        <button type="submit" className="btn-primary w-full" disabled={login.isPending || !email || !password}>
          {login.isPending ? <Spinner /> : <LogIn size={16} />} {t('Sign in')}
        </button>
      </form>
      <Divider label={t('or')} />
      <WalletSignInOptions />
    </AuthCard>
  );
}

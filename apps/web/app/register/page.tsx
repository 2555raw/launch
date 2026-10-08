'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import type { AuthUser } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { AuthCard, Divider, Field } from '@/components/auth/auth-card';
import { WalletSignInOptions } from '@/components/auth/wallet-buttons';
import { fieldErrors, isValidationError } from '@/components/ui/api-errors';
import { Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

type SessionBody = { user: AuthUser; accessToken: string; refreshToken?: string; expiresIn: number };

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function RegisterPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) router.replace('/village');
  }, [ready, user, router]);

  const register = useMutation({
    mutationFn: () => api<SessionBody>('/auth/register', { method: 'POST', json: { email: email.trim(), password, username: username.trim() } }),
    onSuccess: (body) => {
      useAuth.getState().setSession(body);
      toast.success('Your hold is ready', `Welcome to Emberhold, ${body.user.username}.`);
      router.push('/village');
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      setFormError(isValidationError(e) ? 'Please check the highlighted fields.' : errorMessage(e));
    },
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const local: Record<string, string> = {};
    if (!USERNAME_RE.test(username.trim())) local.username = '3–20 characters: letters, numbers and underscores only.';
    if (password.length < 8) local.password = 'Use at least 8 characters.';
    if (confirm !== password) local.confirm = 'Passwords do not match.';
    setErrors(local);
    setFormError(Object.keys(local).length ? 'Please check the highlighted fields.' : null);
    if (Object.keys(local).length) return;
    register.mutate();
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Found a village, raise an army and claim your place on the leaderboard."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-ember-300 hover:text-ember-200">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{formError}</div>}
        <Field label="Username" error={errors.username} hint="This is your chief's name in the game. 3–20 letters, numbers or underscores.">
          <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ember_chief" required />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" error={errors.password} hint="At least 8 characters.">
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Confirm password" error={errors.confirm}>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={register.isPending || !email || !username || !password || !confirm}>
          {register.isPending ? <Spinner /> : <UserPlus size={16} />} Create account
        </button>
      </form>
      <Divider label="or" />
      <WalletSignInOptions />
    </AuthCard>
  );
}

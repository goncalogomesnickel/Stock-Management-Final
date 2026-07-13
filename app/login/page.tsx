'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/ui/Icon';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.ok) {
      router.push('/dashboard');
    } else {
      setError(result.error ?? 'Credenciais inválidas. Tente novamente.');
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      {/* Background accent */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <Icon name="package" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">StockFlow</h1>
          <p className="mt-1 text-sm text-ink-400">Gestão de Stock Interno</p>
        </div>

        <div className="rounded-2xl border border-ink-800 bg-ink-900/80 p-8 shadow-xl backdrop-blur-sm">
          <h2 className="mb-1 text-lg font-semibold text-white">Iniciar sessão</h2>
          <p className="mb-6 text-sm text-ink-400">Introduza as suas credenciais para aceder ao sistema.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-200">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@nickel.pt"
                required
                className="h-11 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 text-sm text-white placeholder:text-ink-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-200">Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-11 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 text-sm text-white placeholder:text-ink-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <Icon name="alert" size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-brand-500 px-6 text-base font-medium text-white shadow-sm transition-all duration-150 hover:bg-brand-600 active:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? 'A iniciar sessão…' : 'Iniciar sessão'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          Acesso restrito a pessoal autorizado. Contacte o IT para obter acesso.
        </p>
      </div>
    </div>
  );
}

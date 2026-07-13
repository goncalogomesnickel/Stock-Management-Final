'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useRequireAuth } from '@/lib/auth';
import type { Movement, MovementType, User } from '@/lib/types';

const typeConfig: Record<
  MovementType,
  {
    label: string;
    tone: 'success' | 'danger' | 'info';
    icon: 'trend-up' | 'trend-down' | 'transfer';
  }
> = {
  IN: { label: 'Entrada', tone: 'success', icon: 'trend-up' },
  OUT: { label: 'Saída', tone: 'danger', icon: 'trend-down' },
  TRANSFER: { label: 'Transferência', tone: 'info', icon: 'transfer' },
};

type MovementWithUser = Movement & { user?: User };

export default function MovementsPage() {
  useRequireAuth();
  const [movements, setMovements] = useState<MovementWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | MovementType>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [movRes, usersRes] = await Promise.all([
      supabase
        .from('movements')
        .select(
          `
        *,
        material:materials!movements_material_id_fkey(*),
        from_warehouse:warehouses!movements_from_warehouse_id_fkey(*),
        to_warehouse:warehouses!movements_to_warehouse_id_fkey(*)
      `
        )
        .order('created_at', { ascending: false }),
      supabase.from('users').select('*'),
    ]);

    const users = (usersRes.data as User[]) ?? [];

    console.log('MOV ERROR:', movRes.error);
    console.log('MOV DATA:', movRes.data);

    const userMap: Record<string, User> = {};
    users.forEach((u) => {
      userMap[u.id] = u;
    });

    const enriched = ((movRes.data as Movement[]) ?? []).map((m) => ({
      ...m,
      user: m.user_id ? userMap[m.user_id] : undefined,
    }));

    setMovements(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = movements.filter((m) => {
    const typeMatch = typeFilter === 'all' || m.type === typeFilter;
    if (!typeMatch) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (m.material?.code ?? '').toLowerCase().includes(term) ||
      (m.material?.name ?? '').toLowerCase().includes(term) ||
      (m.from_warehouse?.name ?? '').toLowerCase().includes(term) ||
      (m.to_warehouse?.name ?? '').toLowerCase().includes(term) ||
      (m.observations ?? '').toLowerCase().includes(term) ||
      (m.destination ?? '').toLowerCase().includes(term) ||
      (m.user?.name ?? '').toLowerCase().includes(term)
    );
  });

  const filterButtons: {
    label: string;
    value: 'all' | MovementType;
    count: number;
  }[] = [
    { label: 'Todos', value: 'all', count: movements.length },
    {
      label: 'Entradas',
      value: 'IN',
      count: movements.filter((m) => m.type === 'IN').length,
    },
    {
      label: 'Saídas',
      value: 'OUT',
      count: movements.filter((m) => m.type === 'OUT').length,
    },
    {
      label: 'Transferências',
      value: 'TRANSFER',
      count: movements.filter((m) => m.type === 'TRANSFER').length,
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Movimentos"
        subtitle="Histórico completo de todos os movimentos de stock."
      />

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setTypeFilter(btn.value)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              typeFilter === btn.value
                ? 'bg-ink-900 text-white shadow-sm'
                : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50'
            }`}
          >
            {btn.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                typeFilter === btn.value
                  ? 'bg-white/20'
                  : 'bg-ink-100 text-ink-500'
              }`}
            >
              {btn.count}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <div className="border-b border-ink-100 p-4">
          <div className="relative max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
              <Icon name="search" size={18} />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por código, material, armazém, utilizador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-ink-400">
            A carregar…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Icon name="arrows" size={24} />}
            title="Sem movimentos"
            description="Os movimentos de stock aparecerão aqui."
          />
        ) : (
          <Table<MovementWithUser>
            columns={[
              {
                key: 'created_at',
                header: 'Data',
                render: (m) => (
                  <span className="text-xs text-ink-500">
                    {formatDate(m.created_at)}
                  </span>
                ),
              },
              {
                key: 'code',
                header: 'Código',
                render: (m) => (
                  <span className="font-mono text-xs font-medium text-ink-600">
                    {m.material?.code ?? '—'}
                  </span>
                ),
              },
              {
                key: 'material',
                header: 'Material',
                render: (m) => (
                  <span className="font-medium text-ink-900">
                    {m.material?.name ?? 'Desconhecido'}
                  </span>
                ),
              },
              {
                key: 'warehouse',
                header: 'Armazém',
                render: (m) => (
                  <span className="text-ink-700">
                    {m.type === 'IN'
                      ? m.to_warehouse?.name ?? '—'
                      : m.type === 'OUT'
                      ? m.from_warehouse?.name ?? '—'
                      : `${m.from_warehouse?.name ?? '—'} → ${
                          m.to_warehouse?.name ?? '—'
                        }`}
                  </span>
                ),
              },
              {
                key: 'type',
                header: 'Tipo',
                render: (m) => {
                  const cfg = typeConfig[m.type];
                  return (
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          cfg.tone === 'success'
                            ? 'bg-emerald-100 text-emerald-600'
                            : cfg.tone === 'danger'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-sky-100 text-sky-600'
                        }`}
                      >
                        <Icon name={cfg.icon} size={16} />
                      </div>
                      <Badge tone={cfg.tone}>{cfg.label}</Badge>
                    </div>
                  );
                },
              },
              {
                key: 'quantity',
                header: 'Quantidade',
                className: 'text-right',
                render: (m) => (
                  <span className="font-semibold text-ink-900">
                    {m.type === 'OUT' ? '-' : '+'}
                    {m.quantity}
                  </span>
                ),
              },
              {
                key: 'user',
                header: 'Utilizador',
                render: (m) => (
                  <span className="text-ink-600">{m.user?.name ?? '—'}</span>
                ),
              },
              {
                key: 'observations',
                header: 'Observações',
                render: (m) => (
                  <div className="max-w-xs">
                    {m.observations ? (
                      <span className="text-sm text-ink-600">
                        {m.observations}
                      </span>
                    ) : m.destination ? (
                      <span className="text-sm text-ink-500">
                        Destino: {m.destination}
                      </span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </div>
                ),
              },
            ]}
            data={filtered}
            emptyMessage="Sem movimentos"
          />
        )}
      </Card>
    </AppLayout>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { formatEuro, formatShortDate } from '@/lib/format';
import { useRequireAuth } from '@/lib/auth';
import type {
  DashboardStats,
  Movement,
  Inventory,
  Material,
} from '@/lib/types';

export default function DashboardPage() {
  useRequireAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalMaterials: 0,
    totalStock: 0,
    lowStockItems: 0,
    todayMovements: 0,
    totalStockValue: 0,
  });
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [lowStock, setLowStock] = useState<
    (Inventory & { material?: Material })[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [materials, inventory, movements] = await Promise.all([
          supabase
            .from('materials')
            .select('*', { count: 'exact', head: true }),
          supabase.from('inventory').select(`
            *,
            material:materials!inventory_material_id_fkey(*),
            warehouse:warehouses!inventory_warehouse_id_fkey(*)
          `),
          supabase
            .from('movements')
            .select(
              `
            *,
            material:materials!movements_material_id_fkey(*),
            from_warehouse:warehouses!movements_from_warehouse_id_fkey(*),
            to_warehouse:warehouses!movements_to_warehouse_id_fkey(*),
            user_id
          `
            )
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        console.log('MATERIALS ERROR:', materials.error);
        console.log('MATERIALS COUNT:', materials.count);

        console.log('INVENTORY ERROR:', inventory.error);
        console.log('INVENTORY DATA:', inventory.data);

        console.log('MOVEMENTS ERROR:', movements.error);
        console.log('MOVEMENTS DATA:', movements.data);

        const inventoryRows =
          (inventory.data as (Inventory & { material?: Material })[]) ?? [];
        const totalStock = inventoryRows.reduce(
          (sum, i) => sum + (i.quantity || 0),
          0
        );
        const totalStockValue = inventoryRows.reduce(
          (sum, i) => sum + (i.quantity || 0) * (i.material?.price || 0),
          0
        );
        const lowStockRows = inventoryRows
          .filter((i) => i.material && i.quantity < i.material.minimum_stock)
          .sort((a, b) => a.quantity - b.quantity)
          .slice(0, 5);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = (movements.data ?? []).filter(
          (m) => new Date(m.created_at) >= today
        ).length;

        setStats({
          totalMaterials: materials.count ?? 0,
          totalStock,
          lowStockItems: lowStockRows.length,
          todayMovements: todayCount,
          totalStockValue,
        });
        setLowStock(lowStockRows);
        setRecentMovements((movements.data as Movement[]) ?? []);
      } catch {
        // Database not yet connected — show empty state.
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const movementIcon = (type: string) => {
    if (type === 'IN')
      return { icon: 'trend-up' as const, tone: 'success' as const };
    if (type === 'OUT')
      return { icon: 'trend-down' as const, tone: 'danger' as const };
  };

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do stock em todos os armazéns."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de Materiais"
          value={loading ? '—' : stats.totalMaterials}
          icon="box"
          tone="brand"
          hint="Materiais registados"
        />
        <StatCard
          label="Total de Stock"
          value={loading ? '—' : stats.totalStock}
          icon="layers"
          tone="info"
          hint="Unidades em stock"
        />
        <StatCard
          label="Stock Baixo"
          value={loading ? '—' : stats.lowStockItems}
          icon="alert"
          tone="warning"
          hint="Abaixo do stock mínimo"
        />
        <StatCard
          label="Movimentos Hoje"
          value={loading ? '—' : stats.todayMovements}
          icon="arrows"
          tone="success"
          hint="Alterações de stock hoje"
        />
      </div>

      {/* Total stock value */}
      <div className="mt-4">
        <div className="group rounded-xl border border-ink-200 bg-white p-5 shadow-card transition-all duration-200 hover:shadow-card-hover">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-ink-500">
                Valor Total em Stock
              </p>
              <p className="mt-2 text-3xl font-bold text-ink-900">
                {loading ? '—' : formatEuro(stats.totalStockValue)}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Quantidade × Preço Unitário
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 transition-transform duration-200 group-hover:scale-110">
              <Icon name="euro" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity + low stock */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Últimos Movimentos"
            subtitle="Alterações de stock mais recentes"
          />
          {recentMovements.length === 0 ? (
            <EmptyState
              icon={<Icon name="arrows" size={24} />}
              title="Sem movimentos"
              description="Os movimentos de stock aparecerão aqui quando registados."
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {recentMovements.map((m) => {
                const mi = movementIcon(m.type);
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-5 py-3.5"
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        mi.tone === 'success'
                          ? 'bg-emerald-100 text-emerald-600'
                          : mi.tone === 'danger'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-sky-100 text-sky-600'
                      }`}
                    >
                      <Icon name={mi.icon} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {m.material?.name ?? 'Material desconhecido'}
                      </p>
                      <p className="text-xs text-ink-500">
                        {m.type === 'IN'
                          ? `Entrada em ${m.to_warehouse?.name ?? '—'}`
                          : `Saída de ${m.from_warehouse?.name ?? '—'}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink-900">
                        {m.quantity}
                      </p>
                      <p className="text-xs text-ink-400">
                        {formatShortDate(m.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Alertas de Stock Baixo"
            subtitle="Materiais abaixo do stock mínimo"
          />
          {lowStock.length === 0 ? (
            <EmptyState
              icon={<Icon name="check" size={24} />}
              title="Stock saudável"
              description="Nenhum material está abaixo do stock mínimo."
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {lowStock.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {s.material?.name ?? 'Desconhecido'}
                    </p>
                    <p className="text-xs text-ink-500">
                      {s.warehouse?.name ?? '—'} · Mín:{' '}
                      {s.material?.minimum_stock ?? 0}
                    </p>
                  </div>
                  <Badge tone="warning">{s.quantity} restantes</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

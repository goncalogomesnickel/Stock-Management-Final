'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { formatEuro } from '@/lib/format';
import { useAuth, useRequireAuth } from '@/lib/auth';
import type { Material, Warehouse, Inventory, MovementType } from '@/lib/types';

type StockRow = {
  material: Material;
  quantities: Record<string, number>;
  total: number;
  totalValue: number;
};

type MoveForm = {
  material_id: string;
  warehouse_id: string;
  type: MovementType;
  quantity: string;
  observations: string;
  destination: string;
};

const emptyMoveForm: MoveForm = {
  material_id: '',
  warehouse_id: '',
  type: 'IN',
  quantity: '',
  observations: '',
  destination: '',
};

export default function StockPage() {
  useRequireAuth();
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [moveForm, setMoveForm] = useState<MoveForm>(emptyMoveForm);
  const [saving, setSaving] = useState(false);
  const [moveError, setMoveError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    const [matRes, whRes, invRes] = await Promise.all([
      supabase
        .from('materials')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true }),

      supabase
        .from('warehouses')
        .select('*')
        .order('name', { ascending: true }),

      supabase.from('inventory').select('*, materials(*), warehouses(*)'),
    ]);

    console.log('MAT ERROR:', matRes.error);
    console.log('WH ERROR:', whRes.error);
    console.log('INV ERROR:', invRes.error);

    console.log('MAT DATA:', matRes.data);
    console.log('WH DATA:', whRes.data);
    console.log('INV DATA:', invRes.data);

    setMaterials((matRes.data as Material[]) ?? []);
    setWarehouses((whRes.data as Warehouse[]) ?? []);
    setInventory((invRes.data as Inventory[]) ?? []);

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const warehouseMap = useMemo(() => {
    const map: Record<string, Warehouse> = {};
    warehouses.forEach((w) => {
      map[w.id] = w;
    });
    return map;
  }, [warehouses]);

  const rows: StockRow[] = useMemo(() => {
    return materials.map((mat) => {
      const quantities: Record<string, number> = {};
      warehouses.forEach((w) => {
        quantities[w.id] = 0;
      });
      inventory
        .filter((i) => i.material_id === mat.id)
        .forEach((i) => {
          if (quantities[i.warehouse_id] !== undefined) {
            quantities[i.warehouse_id] = i.quantity;
          }
        });
      const total = Object.values(quantities).reduce((s, q) => s + q, 0);
      return {
        material: mat,
        quantities,
        total,
        totalValue: total * (mat.price || 0),
      };
    });
  }, [materials, warehouses, inventory]);

  const filteredRows = rows.filter(
    (r) =>
      r.material.name.toLowerCase().includes(search.toLowerCase()) ||
      r.material.code.toLowerCase().includes(search.toLowerCase()) ||
      (r.material.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const grandTotal = filteredRows.reduce((s, r) => s + r.total, 0);
  const grandTotalValue = filteredRows.reduce((s, r) => s + r.totalValue, 0);

  const openMoveModal = (materialId?: string) => {
    setMoveError('');
    setMoveForm({
      ...emptyMoveForm,
      material_id: materialId ?? '',
      warehouse_id: user?.warehouse_id ?? '',
    });
    setModalOpen(true);
  };

  const handleMove = async () => {
    setMoveError('');
    const qty = parseInt(moveForm.quantity, 10);
    if (!moveForm.material_id || !moveForm.warehouse_id || !qty || qty <= 0) {
      setMoveError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (moveForm.type === 'OUT') {
      const currentQty =
        inventory.find(
          (i) =>
            i.material_id === moveForm.material_id &&
            i.warehouse_id === moveForm.warehouse_id
        )?.quantity ?? 0;
      if (qty > currentQty) {
        setMoveError(`Stock insuficiente. Disponível: ${currentQty} unidades.`);
        return;
      }
    }

    setSaving(true);

    try {
      // 1. Update inventory (upsert)
      const { data: existingInv } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('material_id', moveForm.material_id)
        .eq('warehouse_id', moveForm.warehouse_id)
        .maybeSingle();

      const currentQty =
        (existingInv as { quantity: number } | null)?.quantity ?? 0;
      let newQty: number;
      if (moveForm.type === 'IN') {
        newQty = currentQty + qty;
      } else {
        newQty = currentQty - qty;
      }

      if (existingInv) {
        await supabase
          .from('inventory')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', (existingInv as { id: string }).id);
      } else {
        await supabase.from('inventory').insert({
          material_id: moveForm.material_id,
          warehouse_id: moveForm.warehouse_id,
          quantity: newQty,
        });
      }

      // 2. Create movement record
      const movementPayload: Record<string, unknown> = {
        material_id: moveForm.material_id,
        type: moveForm.type,
        quantity: qty,
        user_id: user?.id ?? null,
        observations: moveForm.observations || null,
      };

      if (moveForm.type === 'IN') {
        movementPayload.to_warehouse_id = moveForm.warehouse_id;
        movementPayload.from_warehouse_id = null;
      } else {
        movementPayload.from_warehouse_id = moveForm.warehouse_id;
        movementPayload.to_warehouse_id = null;
        movementPayload.destination = moveForm.destination || null;
      }

      await supabase.from('movements').insert(movementPayload);

      // 3. Refresh and close
      await load();
      setModalOpen(false);
      setMoveForm(emptyMoveForm);
    } catch {
      setMoveError('Erro ao registar movimento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Stock"
        subtitle="Stock actual por armazém e por material."
        action={
          <Button onClick={() => openMoveModal()}>
            <Icon name="transfer" size={18} />
            Movimentar
          </Button>
        }
      />

      <Card>
        <div className="border-b border-ink-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                <Icon name="search" size={18} />
              </span>
              <input
                type="text"
                placeholder="Pesquisar por código, nome ou categoria…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-ink-400">
            A carregar…
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={<Icon name="layers" size={24} />}
            title={search ? 'Nenhum material encontrado' : 'Sem stock'}
            description={
              search
                ? 'Tente outro termo de pesquisa.'
                : 'Adicione materiais na Administração.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Material
                  </th>
                  {warehouses.map((w) => (
                    <th
                      key={w.id}
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500"
                    >
                      {w.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Preço Unit. (€)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Valor Total (€)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const isLow = row.total < row.material.minimum_stock;
                  return (
                    <tr
                      key={row.material.id}
                      className="border-b border-ink-100 transition-colors hover:bg-ink-50"
                    >
                      <td className="px-4 py-3.5 text-sm">
                        <span className="font-mono text-xs font-medium text-ink-600">
                          {row.material.code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-900">
                            {row.material.name}
                          </span>
                          {isLow && <Badge tone="warning">Stock baixo</Badge>}
                        </div>
                        {row.material.category && (
                          <span className="text-xs text-ink-400">
                            {row.material.category}
                          </span>
                        )}
                      </td>
                      {warehouses.map((w) => (
                        <td
                          key={w.id}
                          className="px-4 py-3.5 text-right text-sm"
                        >
                          <span
                            className={
                              row.quantities[w.id] === 0
                                ? 'text-ink-300'
                                : 'text-ink-800'
                            }
                          >
                            {row.quantities[w.id]}
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3.5 text-right text-sm font-semibold text-ink-900">
                        {row.total}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-ink-600">
                        {formatEuro(row.material.price)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold text-ink-900">
                        {formatEuro(row.totalValue)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => openMoveModal(row.material.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-100"
                        >
                          <Icon name="transfer" size={14} />
                          Movimentar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-ink-50">
                  <td
                    colSpan={warehouses.length + 1}
                    className="px-4 py-3.5 text-sm font-semibold text-ink-700"
                  >
                    Total Geral
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-bold text-ink-900">
                    {grandTotal}
                  </td>
                  <td className="px-4 py-3.5"></td>
                  <td className="px-4 py-3.5 text-right text-sm font-bold text-ink-900">
                    {formatEuro(grandTotalValue)}
                  </td>
                  <td className="px-4 py-3.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Movimentar Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Movimentar Stock"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMove} disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {moveError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <Icon name="alert" size={16} />
              {moveError}
            </div>
          )}

          <Select
            label="Material"
            value={moveForm.material_id}
            onChange={(e) =>
              setMoveForm({ ...moveForm, material_id: e.target.value })
            }
          >
            <option value="">Selecione um material…</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </Select>

          <Select
            label="Armazém"
            value={moveForm.warehouse_id}
            onChange={(e) =>
              setMoveForm({ ...moveForm, warehouse_id: e.target.value })
            }
          >
            <option value="">Selecione um armazém…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo"
              value={moveForm.type}
              onChange={(e) =>
                setMoveForm({
                  ...moveForm,
                  type: e.target.value as MovementType,
                  destination: '',
                })
              }
            >
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
            </Select>
            <Input
              label="Quantidade"
              type="number"
              value={moveForm.quantity}
              onChange={(e) =>
                setMoveForm({ ...moveForm, quantity: e.target.value })
              }
              placeholder="0"
            />
          </div>

          {moveForm.type === 'OUT' && (
            <Input
              label="Destino / Obra (opcional)"
              value={moveForm.destination}
              onChange={(e) =>
                setMoveForm({ ...moveForm, destination: e.target.value })
              }
              placeholder="e.g. Obstra Avenida"
            />
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">
              Observações (opcional)
            </label>
            <textarea
              value={moveForm.observations}
              onChange={(e) =>
                setMoveForm({ ...moveForm, observations: e.target.value })
              }
              placeholder="Notas adicionais…"
              rows={3}
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}

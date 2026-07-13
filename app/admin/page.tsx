'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { formatEuro } from '@/lib/format';
import { useRequireAuth } from '@/lib/auth';
import type { Material, Warehouse, User, UserRole } from '@/lib/types';

type Tab = 'materials' | 'users';

type MaterialForm = {
  code: string;
  name: string;
  minimum_stock: string;
  price: string;
  active: boolean;
};

const emptyMaterialForm: MaterialForm = {
  code: '',
  name: '',
  minimum_stock: '10',
  price: '0',
  active: true,
};

type UserForm = {
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  password: string;
};

const emptyUserForm: UserForm = {
  name: '',
  email: '',
  role: 'operator',
  active: true,
  password: '',
};

const roleConfig: Record<
  UserRole,
  { label: string; tone: 'brand' | 'neutral' }
> = {
  admin: { label: 'Administrador', tone: 'brand' },
  operator: { label: 'Operador', tone: 'neutral' },
};

export default function AdminPage() {
  useRequireAuth(['admin']);

  const [tab, setTab] = useState<Tab>('materials');

  // Materials state
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [matLoading, setMatLoading] = useState(true);
  const [matSearch, setMatSearch] = useState('');
  const [matModalOpen, setMatModalOpen] = useState(false);
  const [editingMat, setEditingMat] = useState<Material | null>(null);
  const [matForm, setMatForm] = useState<MaterialForm>(emptyMaterialForm);
  const [matSaving, setMatSaving] = useState(false);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userLoading, setUserLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState('');

  const loadMaterials = useCallback(async () => {
    setMatLoading(true);
    const [matRes, whRes] = await Promise.all([
      supabase.from('materials').select('*').order('name', { ascending: true }),
      supabase.from('warehouses').select('*').order('name'),
    ]);
    setMaterials((matRes.data as Material[]) ?? []);
    setWarehouses((whRes.data as Warehouse[]) ?? []);
    setMatLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setUserLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('name', { ascending: true });
    setUsers((data as User[]) ?? []);
    setUserLoading(false);
  }, []);

  useEffect(() => {
    loadMaterials();
    loadUsers();
  }, [loadMaterials, loadUsers]);

  // --- Materials handlers ---
  const filteredMaterials = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(matSearch.toLowerCase()) ||
      m.code.toLowerCase().includes(matSearch.toLowerCase())
  );

  const openCreateMat = () => {
    setEditingMat(null);
    setMatForm(emptyMaterialForm);
    setMatModalOpen(true);
  };

  const openEditMat = (m: Material) => {
    setEditingMat(m);
    setMatForm({
      code: m.code,
      name: m.name,
      minimum_stock: String(m.minimum_stock),
      price: String(m.price),
      active: m.active,
    });
    setMatModalOpen(true);
  };

  const handleSaveMat = async () => {
    if (!matForm.code || !matForm.name) return;
    setMatSaving(true);
    const payload = {
      code: matForm.code,
      name: matForm.name,
      minimum_stock: parseInt(matForm.minimum_stock, 10) || 0,
      price: parseFloat(matForm.price) || 0,
      active: matForm.active,
    };

    if (editingMat) {
      await supabase.from('materials').update(payload).eq('id', editingMat.id);
    } else {
      await supabase.from('materials').insert(payload);
    }

    setMatSaving(false);
    setMatModalOpen(false);
    loadMaterials();
  };

  const toggleMaterialActive = async (m: Material) => {
    await supabase
      .from('materials')
      .update({ active: !m.active })
      .eq('id', m.id);
    loadMaterials();
  };

  // --- Users handlers ---
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const openCreateUser = () => {
    setEditingUser(null);
    setUserError('');
    setUserForm(emptyUserForm);
    setUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUserError('');
    setUserForm({
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      password: '',
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.email) return;
    setUserError('');
    setUserSaving(true);

    if (editingUser) {
      const payload = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        active: userForm.active,
      };
      await supabase.from('users').update(payload).eq('id', editingUser.id);
      setUserSaving(false);
      setUserModalOpen(false);
      loadUsers();
    } else {
      if (!userForm.password || userForm.password.length < 6) {
        setUserError('A palavra-passe deve ter pelo menos 6 caracteres.');
        setUserSaving(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-auth-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token ?? ''}`,
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
            },
            body: JSON.stringify({
              name: userForm.name,
              email: userForm.email,
              role: userForm.role,
              password: userForm.password,
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json();

          console.log('CREATE USER ERROR:', errData);

          setUserError(
            JSON.stringify(errData, null, 2) || 'Erro ao criar utilizador.'
          );

          setUserSaving(false);
          return;
        }

        setUserSaving(false);
        setUserModalOpen(false);
        loadUsers();
      } catch {
        setUserError('Erro de ligação ao criar utilizador.');
        setUserSaving(false);
      }
    }
  };

  const toggleUserActive = async (u: User) => {
    await supabase.from('users').update({ active: !u.active }).eq('id', u.id);
    loadUsers();
  };

  const warehouseName = (id: string | null) =>
    warehouses.find((w) => w.id === id)?.name ?? '—';

  return (
    <AppLayout>
      <PageHeader
        title="Administração"
        subtitle="Gestão de materiais e utilizadores."
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab('materials')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === 'materials'
              ? 'bg-ink-900 text-white shadow-sm'
              : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50'
          }`}
        >
          <Icon name="box" size={18} />
          Materiais
        </button>
        <button
          onClick={() => setTab('users')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            tab === 'users'
              ? 'bg-ink-900 text-white shadow-sm'
              : 'bg-white text-ink-600 border border-ink-200 hover:bg-ink-50'
          }`}
        >
          <Icon name="users" size={18} />
          Utilizadores
        </button>
      </div>

      {/* Materials Tab */}
      {tab === 'materials' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                <Icon name="search" size={18} />
              </span>
              <input
                type="text"
                placeholder="Pesquisar por referência ou nome..."
                value={matSearch}
                onChange={(e) => setMatSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <Button onClick={openCreateMat}>
              <Icon name="plus" size={18} />
              Adicionar Material
            </Button>
          </div>

          {matLoading ? (
            <div className="px-5 py-12 text-center text-sm text-ink-400">
              A carregar…
            </div>
          ) : filteredMaterials.length === 0 ? (
            <EmptyState
              icon={<Icon name="box" size={24} />}
              title={matSearch ? 'Nenhum material encontrado' : 'Sem materiais'}
              description={
                matSearch
                  ? 'Tente outro termo de pesquisa.'
                  : 'Adicione o primeiro material.'
              }
              action={
                !matSearch ? (
                  <Button onClick={openCreateMat}>
                    <Icon name="plus" size={18} />
                    Adicionar Material
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table<Material>
              columns={[
                {
                  key: 'code',
                  header: 'Referência',
                  render: (m) => (
                    <span className="font-mono text-xs font-medium text-ink-600">
                      {m.code}
                    </span>
                  ),
                },
                {
                  key: 'name',
                  header: 'Nome',
                  render: (m) => (
                    <span className="font-medium text-ink-900">{m.name}</span>
                  ),
                },
                {
                  key: 'minimum_stock',
                  header: 'Stock Mínimo',
                  render: (m) => (
                    <span className="text-ink-600">{m.minimum_stock}</span>
                  ),
                },
                {
                  key: 'price',
                  header: 'Preço Unit. (€)',
                  className: 'text-right',
                  render: (m) => (
                    <span className="text-ink-600">{formatEuro(m.price)}</span>
                  ),
                },
                {
                  key: 'active',
                  header: 'Activo',
                  render: (m) => (
                    <Badge tone={m.active ? 'success' : 'neutral'}>
                      {m.active ? 'Sim' : 'Não'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (m) => (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditMat(m);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                        aria-label="Editar"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMaterialActive(m);
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          m.active
                            ? 'text-ink-500 hover:bg-amber-50 hover:text-amber-600'
                            : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                        aria-label={m.active ? 'Desactivar' : 'Activar'}
                        title={m.active ? 'Desactivar' : 'Activar'}
                      >
                        <Icon name="power" size={16} />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={filteredMaterials}
              emptyMessage="Nenhum material encontrado"
            />
          )}
        </Card>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                <Icon name="search" size={18} />
              </span>
              <input
                type="text"
                placeholder="Pesquisar por nome ou email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <Button onClick={openCreateUser}>
              <Icon name="plus" size={18} />
              Adicionar Utilizador
            </Button>
          </div>

          {userLoading ? (
            <div className="px-5 py-12 text-center text-sm text-ink-400">
              A carregar…
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={<Icon name="users" size={24} />}
              title={
                userSearch ? 'Nenhum utilizador encontrado' : 'Sem utilizadores'
              }
              description={
                userSearch
                  ? 'Tente outro termo de pesquisa.'
                  : 'Adicione o primeiro utilizador.'
              }
              action={
                !userSearch ? (
                  <Button onClick={openCreateUser}>
                    <Icon name="plus" size={18} />
                    Adicionar Utilizador
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table<User>
              columns={[
                {
                  key: 'name',
                  header: 'Nome',
                  render: (u) => (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-600">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-ink-900">{u.name}</span>
                    </div>
                  ),
                },
                {
                  key: 'email',
                  header: 'Email',
                  render: (u) => (
                    <span className="text-ink-600">{u.email}</span>
                  ),
                },
                {
                  key: 'role',
                  header: 'Cargo',
                  render: (u) => {
                    const cfg = roleConfig[u.role];
                    return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
                  },
                },
                {
                  key: 'active',
                  header: 'Activo',
                  render: (u) => (
                    <Badge tone={u.active ? 'success' : 'neutral'}>
                      {u.active ? 'Sim' : 'Não'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'text-right',
                  render: (u) => (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditUser(u);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                        aria-label="Editar"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleUserActive(u);
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          u.active
                            ? 'text-ink-500 hover:bg-amber-50 hover:text-amber-600'
                            : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                        aria-label={u.active ? 'Desactivar' : 'Activar'}
                        title={u.active ? 'Desactivar' : 'Activar'}
                      >
                        <Icon name="power" size={16} />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={filteredUsers}
              emptyMessage="Nenhum utilizador encontrado"
            />
          )}
        </Card>
      )}

      {/* Material Modal */}
      <Modal
        open={matModalOpen}
        onClose={() => setMatModalOpen(false)}
        title={editingMat ? 'Editar Material' : 'Adicionar Material'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMatModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveMat} disabled={matSaving}>
              {matSaving ? 'A guardar…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Referência"
              name="code"
              value={matForm.code}
              onChange={(e) => setMatForm({ ...matForm, code: e.target.value })}
              placeholder="e.g. REF-001"
            />
          </div>
          <Input
            label="Nome"
            name="name"
            value={matForm.name}
            onChange={(e) => setMatForm({ ...matForm, name: e.target.value })}
            placeholder="e.g. Totem Reborn"
          />
          <div className="grid-cols-2">
            <Input
              label="Stock Mínimo"
              name="minimum_stock"
              type="number"
              value={matForm.minimum_stock}
              onChange={(e) =>
                setMatForm({ ...matForm, minimum_stock: e.target.value })
              }
              placeholder="10"
            />
            <Input
              label="Preço Unit. (€)"
              name="price"
              type="number"
              step="0.01"
              value={matForm.price}
              onChange={(e) =>
                setMatForm({ ...matForm, price: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={matForm.active}
              onChange={(e) =>
                setMatForm({ ...matForm, active: e.target.checked })
              }
              className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-400"
            />
            <span className="text-sm font-medium text-ink-700">
              Material activo
            </span>
          </label>
        </div>
      </Modal>

      {/* User Modal */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? 'Editar Utilizador' : 'Adicionar Utilizador'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} disabled={userSaving}>
              {userSaving ? 'A guardar…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {userError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <Icon name="alert" size={16} />
              {userError}
            </div>
          )}
          <Input
            label="Nome"
            name="name"
            value={userForm.name}
            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            placeholder="e.g. João Silva"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={userForm.email}
            onChange={(e) =>
              setUserForm({ ...userForm, email: e.target.value })
            }
            placeholder="e.g. joao@nickel.pt"
          />
          {!editingUser && (
            <Input
              label="Palavra-passe"
              name="password"
              type="password"
              value={userForm.password}
              onChange={(e) =>
                setUserForm({ ...userForm, password: e.target.value })
              }
              placeholder="Mínimo 6 caracteres"
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Cargo"
              value={userForm.role}
              onChange={(e) =>
                setUserForm({ ...userForm, role: e.target.value as UserRole })
              }
            >
              <option value="admin">Administrador</option>
              <option value="operator">Operador</option>
            </Select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={userForm.active}
              onChange={(e) =>
                setUserForm({ ...userForm, active: e.target.checked })
              }
              className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-400"
            />
            <span className="text-sm font-medium text-ink-700">
              Utilizador activo
            </span>
          </label>
        </div>
      </Modal>
    </AppLayout>
  );
}

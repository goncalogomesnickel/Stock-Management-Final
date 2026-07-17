export type Warehouse = {
  id: string;
  name: string;
  location: string | null;
  created_at: string;
};

export type Material = {
  id: string;
  code: string;
  code_icp: string | null;
  name: string;
  unit: string | null;
  minimum_stock: number;
  price: number;
  active: boolean;
  created_at: string;
};

export type Inventory = {
  id: string;
  material_id: string;
  warehouse_id: string;
  quantity: number;
  updated_at: string;
  material?: Material;
  warehouse?: Warehouse;
};

export type MovementType = 'IN' | 'OUT';

export type Movement = {
  id: string;
  material_id: string;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  type: MovementType;
  quantity: number;
  user_id: string | null;
  observations: string | null;
  destination: string | null;
  created_at: string;
  material?: Material;
  from_warehouse?: Warehouse;
  to_warehouse?: Warehouse;
  user?: User;
};

export type UserRole = 'admin' | 'operator';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  warehouse_id: string | null;
  active: boolean;
  created_at: string;
};

export type DashboardStats = {
  totalMaterials: number;
  totalStock: number;
  lowStockItems: number;
  todayMovements: number;
  totalStockValue: number;
};

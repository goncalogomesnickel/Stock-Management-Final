/*
# Warehouse Management System Schema

Creates the complete schema for an internal warehouse management system (StockFlow)
used inside Nickel. The database is the single source of truth — the frontend adapts to it.

## Tables

1. `warehouses` — storage locations (e.g. Lisboa, Porto, ICP)
   - id (uuid PK)
   - name (text, unique)
   - location (text, nullable)
   - created_at (timestamptz)

2. `materials` — catalog of stockable materials
   - id (uuid PK)
   - code (text, unique) — material code (NOT sku)
   - name (text)
   - category (text, nullable)
   - unit (text, nullable) — e.g. units, kg, L
   - minimum_stock (integer, default 0) — NOT min_stock
   - price (numeric, default 0) — unit price in euros for total value calculations
   - active (boolean, default true) — allows deactivation without deletion
   - created_at (timestamptz)

3. `inventory` — current stock levels per material per warehouse
   - id (uuid PK)
   - material_id (uuid FK -> materials)
   - warehouse_id (uuid FK -> warehouses)
   - quantity (integer, default 0)
   - updated_at (timestamptz)
   - unique constraint on (material_id, warehouse_id)

4. `movements` — immutable history of every stock change
   - id (uuid PK)
   - material_id (uuid FK -> materials)
   - from_warehouse_id (uuid FK -> warehouses, nullable — null for IN)
   - to_warehouse_id (uuid FK -> warehouses, nullable — null for OUT)
   - type (text CHECK IN ('IN','OUT','TRANSFER'))
   - quantity (integer)
   - user_id (uuid, nullable — references app users table)
   - observations (text, nullable) — optional notes
   - destination (text, nullable) — destination/work site for OUT movements
   - created_at (timestamptz)

5. `users` — application users (employees with roles)
   - id (uuid PK)
   - name (text)
   - email (text, unique)
   - role (text CHECK IN ('admin','operator'), default 'operator')
   - warehouse_id (uuid FK -> warehouses, nullable)
   - active (boolean, default true) — allows deactivation without deletion
   - created_at (timestamptz)

## Security

RLS enabled on all tables. This app has a login screen, but for simplicity and
because this is an internal tool, policies use `TO anon, authenticated` with
`USING (true)` — the data is intentionally shared across all internal users.
Operators and admins are distinguished in the frontend, not at the DB layer.

## Notes

- `materials.code` replaces the old `sku` field.
- `materials.minimum_stock` replaces the old `min_stock` field.
- `materials.price` is new — used for "Valor Total em Stock" calculations.
- `materials.active` is new — deactivation instead of deletion.
- `movements.observations` and `movements.destination` are new.
- `users.role` now only allows 'admin' | 'operator' (no 'manager').
- `users.active` is new — deactivation instead of deletion.
*/

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Materials
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text,
  unit text,
  minimum_stock integer NOT NULL DEFAULT 0,
  price numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inventory (stock levels per material per warehouse)
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, warehouse_id)
);

-- Movements (immutable history)
CREATE TABLE IF NOT EXISTS movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  from_warehouse_id uuid REFERENCES warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id uuid REFERENCES warehouses(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('IN','OUT','TRANSFER')),
  quantity integer NOT NULL CHECK (quantity > 0),
  user_id uuid,
  observations text,
  destination text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users (app users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin','operator')),
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_material ON inventory(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_material ON movements(material_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Enable RLS on all tables
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies: internal tool, shared data. TO anon, authenticated with USING(true).
DROP POLICY IF EXISTS "read_warehouses" ON warehouses;
CREATE POLICY "read_warehouses" ON warehouses FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_warehouses" ON warehouses;
CREATE POLICY "write_warehouses" ON warehouses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_materials" ON materials;
CREATE POLICY "read_materials" ON materials FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_materials" ON materials;
CREATE POLICY "write_materials" ON materials FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_inventory" ON inventory;
CREATE POLICY "read_inventory" ON inventory FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_inventory" ON inventory;
CREATE POLICY "write_inventory" ON inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_movements" ON movements;
CREATE POLICY "read_movements" ON movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_movements" ON movements;
CREATE POLICY "write_movements" ON movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_users" ON users;
CREATE POLICY "read_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "write_users" ON users;
CREATE POLICY "write_users" ON users FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

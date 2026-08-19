-- ============================================================================
-- Order Management ERP — Database Schema (v1)
-- Arieckal Industries
-- Target: PostgreSQL 14+
-- ============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('superadmin', 'module_admin', 'user');
CREATE TYPE module_name AS ENUM ('tender_bid', 'sales', 'purchase', 'stores', 'production', 'quality', 'dispatch_accounts', 'management');
CREATE TYPE bid_status AS ENUM ('quoted', 'not_quoted');
CREATE TYPE bid_result AS ENUM ('won', 'lost', 'pending');
CREATE TYPE payment_status AS ENUM ('paid', 'partially_paid', 'unpaid', 'overdue');
CREATE TYPE lab_result AS ENUM ('pass', 'fail', 'pending');
CREATE TYPE assembly_status AS ENUM ('not_started', 'in_progress', 'done');
CREATE TYPE work_order_status AS ENUM ('draft', 'received', 'processing', 'partially_dispatched', 'completed', 'closed');
CREATE TYPE vendor_po_status AS ENUM ('draft', 'issued', 'partially_received', 'received', 'closed');
CREATE TYPE tax_type AS ENUM ('igst', 'cgst_sgst');
CREATE TYPE alert_trigger_type AS ENUM ('bid_submission', 'payment_due', 'vendor_delivery', 'delivery_due', 'lab_result_pending');

-- ---------------------------------------------------------------------------
-- USERS & AUTH  (Module: Master Data / System)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(200) NOT NULL,
    email            VARCHAR(255) UNIQUE NOT NULL,      -- username = email, per spec
    password_hash    TEXT NOT NULL,
    role             user_role NOT NULL DEFAULT 'user',
    job_title        VARCHAR(200),                       -- e.g. "Head Production", "Design Engineer"
    is_active        BOOLEAN NOT NULL DEFAULT true,
    password_set_at  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- drives the 180-day reset rule
    created_by       UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which modules a user can access (many-to-many)
CREATE TABLE user_module_access (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module     module_name NOT NULL,
    can_edit   BOOLEAN NOT NULL DEFAULT true,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, module)
);

-- Password reset tokens (email-link flow)
CREATE TABLE password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generic status-history log shared by every module (per architecture doc)
-- entity_id is VARCHAR because most business entities (work orders, vendor POs,
-- tender/bid records) use human-readable formatted IDs, not UUIDs.
CREATE TABLE status_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type   VARCHAR(50) NOT NULL,   -- e.g. 'work_order', 'vendor_po'
    entity_id     VARCHAR(50) NOT NULL,
    from_status   VARCHAR(50),
    to_status     VARCHAR(50) NOT NULL,
    changed_by    UUID REFERENCES users(id),
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    note          TEXT
);
CREATE INDEX idx_status_history_entity ON status_history(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- MASTER DATA
-- ---------------------------------------------------------------------------
CREATE TABLE clients (
    client_id         CHAR(6) PRIMARY KEY,             -- 6-letter alphanumeric, e.g. 'CLA1AB'
    client_name       VARCHAR(255) NOT NULL,
    contact_person     VARCHAR(200),
    client_mobile      VARCHAR(20),
    client_email       VARCHAR(255),
    client_address     TEXT,
    client_dispatch_address TEXT,
    client_gst         VARCHAR(20),
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_by         UUID REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendors (
    vendor_id       VARCHAR(10) PRIMARY KEY,           -- format 'VN-0000'
    vendor_name     VARCHAR(255) NOT NULL,
    contact_person  VARCHAR(200),
    phone           VARCHAR(20),
    email           VARCHAR(255),
    gstin           VARCHAR(20),
    address         TEXT,
    category        VARCHAR(200),                       -- items/category supplied
    rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE vendor_id_seq START 1;

CREATE TABLE parts (
    part_id         VARCHAR(10) PRIMARY KEY,           -- format 'PN-0000'
    description     TEXT NOT NULL,
    hsn_code        VARCHAR(20),
    unit            VARCHAR(20),                        -- Nos / Kg / Mtrs etc.
    drawing_ref     VARCHAR(200),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE part_id_seq START 1;
CREATE SEQUENCE tender_order_id_seq START 1;

-- Bill of Materials — self-referencing (a part can be made of sub-parts)
CREATE TABLE bom_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_part_id  VARCHAR(10) NOT NULL REFERENCES parts(part_id),
    child_part_id   VARCHAR(10) NOT NULL REFERENCES parts(part_id),
    qty_required    NUMERIC(12,3) NOT NULL,
    UNIQUE(parent_part_id, child_part_id)
);

-- ---------------------------------------------------------------------------
-- MODULE: TENDER / BID
-- ---------------------------------------------------------------------------
CREATE TABLE tenders_bids (
    order_id            VARCHAR(20) PRIMARY KEY,        -- staff-sheet 'Order_id'
    item_description    TEXT NOT NULL,
    quantity            NUMERIC(12,2) NOT NULL,
    bid_submission_due  DATE NOT NULL,
    bid_status          bid_status NOT NULL DEFAULT 'not_quoted',
    result              bid_result NOT NULL DEFAULT 'pending',
    po_id               VARCHAR(20) UNIQUE,               -- filled once won; UNIQUE so work_orders can reference it
    tender_id           VARCHAR(50),                      -- GeM / govt reference, nullable for direct orders
    notes               TEXT,
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- MODULE: SALES / WORK ORDER
-- ---------------------------------------------------------------------------
CREATE TABLE work_orders (
    work_order_id     VARCHAR(20) PRIMARY KEY,          -- auto-generated 'SO-0000'
    po_id             VARCHAR(20) REFERENCES tenders_bids(po_id),
    client_id         CHAR(6) NOT NULL REFERENCES clients(client_id),
    item_description  TEXT NOT NULL,
    quantity          NUMERIC(12,2) NOT NULL,
    rate              NUMERIC(14,2) NOT NULL,
    value             NUMERIC(16,2) GENERATED ALWAYS AS (quantity * rate) STORED,
    delivery_period_days INTEGER,
    promised_delivery_date DATE,
    actual_delivery_date   DATE,
    bill_no           VARCHAR(50),
    payment_status    payment_status NOT NULL DEFAULT 'unpaid',
    deduction_tds     NUMERIC(14,2) DEFAULT 0,
    deduction_ld      NUMERIC(14,2) DEFAULT 0,
    deduction_sd      NUMERIC(14,2) DEFAULT 0,
    deduction_misc    NUMERIC(14,2) DEFAULT 0,
    status            work_order_status NOT NULL DEFAULT 'draft',
    remarks           TEXT,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE work_order_id_seq START 1;
CREATE INDEX idx_work_orders_client ON work_orders(client_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);

-- ---------------------------------------------------------------------------
-- MODULE: PURCHASE
-- ---------------------------------------------------------------------------
CREATE TABLE vendor_pos (
    vendor_po_id      VARCHAR(20) PRIMARY KEY,          -- 'PO-0000'
    vendor_id         VARCHAR(10) NOT NULL REFERENCES vendors(vendor_id),
    work_order_id     VARCHAR(20) REFERENCES work_orders(work_order_id),
    enquiry_ref       VARCHAR(100),
    quotation_ref     VARCHAR(100),
    delivery_period_days INTEGER,
    promised_delivery_date DATE,
    status            vendor_po_status NOT NULL DEFAULT 'draft',
    vendor_payment_status payment_status NOT NULL DEFAULT 'unpaid',
    remarks           TEXT,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE vendor_po_id_seq START 1;

-- Line items on a Vendor PO. Rejections/replacements are added as NEW LINES
-- on the SAME vendor_po_id (confirmed "Option A") rather than a new PO.
CREATE TABLE vendor_po_lines (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_po_id      VARCHAR(20) NOT NULL REFERENCES vendor_pos(vendor_po_id) ON DELETE CASCADE,
    part_id           VARCHAR(10) REFERENCES parts(part_id),
    line_type         VARCHAR(20) NOT NULL DEFAULT 'original', -- 'original' | 'rework' | 'replacement'
    original_line_id  UUID REFERENCES vendor_po_lines(id),      -- points back to the line it replaces, if any
    quantity          NUMERIC(12,2) NOT NULL,
    rate              NUMERIC(14,2),
    received_qty      NUMERIC(12,2) DEFAULT 0,
    stock_no          VARCHAR(20),                              -- generated part/stock number on receipt
    lab_name          VARCHAR(200),
    lab_result        lab_result NOT NULL DEFAULT 'pending',
    lab_report_no     VARCHAR(50),
    remarks           TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- MODULE: STORES / INVENTORY
-- ---------------------------------------------------------------------------
CREATE TABLE stock_ledger (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id           VARCHAR(10) NOT NULL REFERENCES parts(part_id),
    lab_report_no     VARCHAR(50),
    work_order_id     VARCHAR(20) REFERENCES work_orders(work_order_id),
    purchase_qty      NUMERIC(14,3) NOT NULL DEFAULT 0,
    issued_qty        NUMERIC(14,3) NOT NULL DEFAULT 0,
    unit              VARCHAR(20),                              -- unit/kg/mtrs
    net_balance_qty   NUMERIC(14,3) GENERATED ALWAYS AS (purchase_qty - issued_qty) STORED,
    transaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_ledger_part ON stock_ledger(part_id);

-- ---------------------------------------------------------------------------
-- MODULE: PRODUCTION (simple model, per confirmed v1 scope)
-- ---------------------------------------------------------------------------
CREATE TABLE production_tracking (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id          VARCHAR(20) NOT NULL REFERENCES work_orders(work_order_id),
    raw_material_required  NUMERIC(14,3),
    raw_material_available NUMERIC(14,3),
    raw_material_to_order  NUMERIC(14,3) GENERATED ALWAYS AS (
                               GREATEST(COALESCE(raw_material_required,0) - COALESCE(raw_material_available,0), 0)
                           ) STORED,
    assembly_status        assembly_status NOT NULL DEFAULT 'not_started',
    ready_for_inspection   BOOLEAN NOT NULL DEFAULT false,
    remarks                TEXT,
    updated_by             UUID REFERENCES users(id),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_production_work_order ON production_tracking(work_order_id);

-- ---------------------------------------------------------------------------
-- MODULE: DISPATCH / ACCOUNTS
-- ---------------------------------------------------------------------------
CREATE TABLE dispatches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id     VARCHAR(20) NOT NULL REFERENCES work_orders(work_order_id),
    dispatch_date     DATE NOT NULL,
    challan_no        VARCHAR(50),
    dispatched_qty    NUMERIC(12,2) NOT NULL,
    dispatched_through VARCHAR(200),
    destination       VARCHAR(200),
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
    invoice_id        VARCHAR(30) PRIMARY KEY,          -- 'AIN-0000' plus FY suffix at display time
    work_order_id     VARCHAR(20) NOT NULL REFERENCES work_orders(work_order_id),
    dispatch_id       UUID REFERENCES dispatches(id),
    invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    buyers_order_no   VARCHAR(50),
    buyers_order_date DATE,
    tax_type          tax_type NOT NULL,                 -- igst | cgst_sgst, derived from buyer state vs seller state
    taxable_value     NUMERIC(16,2) NOT NULL,
    tax_rate          NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    tax_amount        NUMERIC(16,2) GENERATED ALWAYS AS (taxable_value * tax_rate / 100) STORED,
    total_amount      NUMERIC(16,2) GENERATED ALWAYS AS (taxable_value + taxable_value * tax_rate / 100) STORED,
    payment_status    payment_status NOT NULL DEFAULT 'unpaid',
    amount_paid       NUMERIC(16,2) NOT NULL DEFAULT 0,
    due_date          DATE,
    created_by        UUID REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE invoice_id_seq START 1;
CREATE INDEX idx_invoices_work_order ON invoices(work_order_id);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE payment_status IN ('unpaid','partially_paid','overdue');

CREATE TABLE invoice_lines (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id        VARCHAR(30) NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    description       TEXT NOT NULL,
    drawing_ref       VARCHAR(200),
    hsn_sac           VARCHAR(20),
    gst_rate          NUMERIC(5,2),
    quantity          NUMERIC(12,2),
    rate              NUMERIC(14,2),
    unit              VARCHAR(20),
    discount_pct      NUMERIC(5,2) DEFAULT 0,
    amount            NUMERIC(16,2),
    line_kind         VARCHAR(20) NOT NULL DEFAULT 'item' -- 'item' | 'packing' | 'forwarding' | 'freight'
);

-- ---------------------------------------------------------------------------
-- MODULE: MANAGEMENT / CONTROL — ALERT CONFIGURATION
-- ---------------------------------------------------------------------------
CREATE TABLE alert_settings (
    trigger_type      alert_trigger_type PRIMARY KEY,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    days_before_alert1 INTEGER NOT NULL DEFAULT 7,
    days_before_alert2 INTEGER NOT NULL DEFAULT 3,
    send_time         TIME NOT NULL DEFAULT '09:30',
    recipient_emails  TEXT[] NOT NULL DEFAULT '{}',
    updated_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the confirmed defaults
INSERT INTO alert_settings (trigger_type, days_before_alert1, days_before_alert2, send_time) VALUES
    ('bid_submission',      7, 3, '09:00'),
    ('payment_due',         7, 3, '09:30'),
    ('vendor_delivery',     7, 3, '09:30'),
    ('delivery_due',        7, 3, '09:30'),
    ('lab_result_pending',  7, 3, '09:30');

CREATE TABLE alert_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_type   alert_trigger_type NOT NULL,
    entity_type    VARCHAR(50) NOT NULL,
    entity_id      VARCHAR(50) NOT NULL,
    sent_to        TEXT[] NOT NULL,
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- MODULE SETTINGS — Creator-controlled on/off switches (v1 add-on)
-- ---------------------------------------------------------------------------
CREATE TABLE module_settings (
    module      module_name PRIMARY KEY,
    is_enabled  BOOLEAN NOT NULL DEFAULT true,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO module_settings (module) VALUES
    ('tender_bid'), ('sales'), ('purchase'), ('stores'),
    ('production'), ('quality'), ('dispatch_accounts'), ('management');

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-update `updated_at` columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_parts_updated_at BEFORE UPDATE ON parts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vendor_pos_updated_at BEFORE UPDATE ON vendor_pos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tenders_bids_updated_at BEFORE UPDATE ON tenders_bids FOR EACH ROW EXECUTE FUNCTION set_updated_at();

# Order Management ERP — System Architecture (v1 Scope)

Based on: original requirements brief + `order_management_erp_relationship_diagram.pptx` + clarifications on production tracking, vendor workflow, and Lab/TPI + field-reference from `Manufacturing_ERP_System-V1_1.xlsm` ("e-zearpro" template by Prowessz Consulting Services LLP, reference only, not live data) + staff-drafted field list (`Updated_req-_DRAFT_EXCEL_TRACKING_SHEET.xlsx`, sheet `Working-test`).

**ID convention (standardized across all modules):** `VN-0000` (Vendor), `PN-0000` (Part), `PO-0000` (Purchase Order), `SO-0000`/Work Order Id (Sales Order), `AIN-0000` (Invoice), `LB-0000` (Lab Test). All IDs use this consistent 4-digit zero-padded format — no mixed formats like `VEN-0001`.

**Order lifecycle (confirmed, applies to every order — tender-based or direct):**
Tender/Bid → PO Id → Sales/Work Order → Procurement → Production (simple) → Stock → Dispatch/Invoice

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React (mobile-responsive) | Accessible via browser link, no app install. Must work correctly on Chrome, Safari, Edge, and Firefox — built with standard web APIs, no browser-specific dependencies. |
| Backend | Node.js / Express (or equivalent) | REST API |
| Database | PostgreSQL | Relational — fits the interlinked-module requirement |
| Hosting | Free-tier cloud (e.g. Supabase + Vercel/Render) | Zero recurring cost, accepted trade-off: occasional pause after inactivity, no formal SLA/backups — mitigated with scheduled keep-alive + monthly manual export |
| Auth | Email/password (username = user's email id, can differ from official work email), role-based module access | Superadmin + Module Admins manage users; details in Section 7 |
| Alerts | Scheduled job + free-tier email API | Daily scan for due dates / pending payments / delays |
| Dates | Datepicker on every date field | Display format: `dd-MMM-yyyy` |

---

## 2. Modules (9)

0. **Tender / Bid** *(new — confirmed to apply to all orders, not just government/GeM)* — Order_id, Item, Quantity, Bid Submission Due Date, Bid Status (Quoted/Not Quoted), Result (Won/Lost), PO Id, Tender Id (GeM/govt reference), Notes
1. **Master Data** — Customer, Vendor, Part Master, BOM, Users/Roles
   - **Client Master (confirmed):** Client_id (6-letter alphanumeric), Client Name, Contact Person, Client_mobile, Client_email, Client_address, Client_dispatch_address, Client GST. All master data fields (Client, Vendor, Part, etc.) are editable directly from the frontend by superadmins — no separate admin/database tool needed for changes.
2. **Sales / Order** — PO Id (from Tender/Bid) → Work Order Id (auto-generated), Client, Item, Qty, Rate, Value, Delivery Period, Actual Delivery Date, Bill No., Payment Status, Deductions (TDS/LD/SD/Misc), Remarks
3. **Purchase** — Enquiries to vendor, Quotation, Rates, Vendor PO, Delivery Period, Received Material, Lab Name/Result/Report (tied directly to the procurement record), Vendor Payment. **Rejection handling (confirmed):** a rejected item is added as a new line on the *same* original Vendor PO, not a separate linked PO — keeps original qty, rejected qty, and replacement qty all on one document for that PO.
4. **Stores / Inventory** — Stock/Part No, Purchase Stock Qty, Total Stock Qty, Issued Qty for Work Order, Net Balance Qty (simple ledger math, not the full multi-state inventory chain)
5. **Production** *(confirmed: simple model for v1, not the detailed multi-stage pptx version)* — Work Order Id (linked), Client, Item, Qty, Raw Material Required/Available/To-Order, Assembly Status, Ready for Inspection, Remarks
6. **Quality** — Lab Name, Lab Result (Pass/Fail), Lab Report No. — tracked within Procurement, referenced from Stock
7. **Dispatch / Accounts** — Bill No., Payment Status (Paid/Partially Paid/Unpaid/Overdue), Deductions, GST-compliant PDF invoice
   - **Confirmed invoice layout** (from sample): Company header (name, address, GSTIN/UIN, state+code, contact, email); Invoice No. with financial-year suffix (e.g. `AI-042/2026-2027`); Dated; Delivery Note/Challan No.; Mode/Terms of Payment; Reference No. & Date; Buyer's Order No. (PO No.) + Dated; Dispatch Doc No.; Delivery Note Date; Dispatched Through; Destination; Terms of Delivery; separate **Consignee (Ship to)** and **Buyer (Bill to)** blocks, each with GSTIN/UIN + State & Code; line-item table (Sl No, Description with drawing/spec sub-line, HSN/SAC, GST Rate, Quantity, Rate, per, Disc %, Amount); additional charge lines (Packing/Forwarding/Freight) each with their own HSN/SAC + GST rate; tax line — **IGST** for inter-state, **CGST+SGST split** for intra-state; Total Qty + Total Amount; Amount Chargeable in words; HSN/SAC-wise tax summary table (Taxable Value, Rate, Tax Amount, Total Tax per code); Tax Amount in words; fixed declaration text; Authorised Signatory block; "Computer Generated Invoice" footer note.
8. **Management / Control** — Dashboard, Monthly Review, configurable Alerting rules

All modules share Master IDs (Customer, Vendor, Part, PO Id, Work Order Id) and write to a common **Status History log** per entity.

---

## 3. Core Data Model (entities & relationships)

```
Customer ──1:N── Customer PO ──1:N── Sales Order ──1:N── Order Line
                                                              │
                                                    N:1 ──► Part Master ──1:N── BOM Line (self-referencing)
                                                              │
                          ┌───────────────────────────────────┼───────────────────────────────────┐
                          │                                   │                                     │
                  Production Stage(s)                 Vendor PO Line                        Lab Report / TPI
                  (if Make-flagged)                  (if Buy/Vendor-flagged)               (if inspection-required flag = Y)


Vendor ──1:N── Vendor RFQ (optional) ──N:1── Quotation (optional) ──1:1── Approval (optional) ──1:1── Vendor PO
                                                                                                          │
                                                                                              1:N── Receipt ──1:N── Inspection
                                                                                                          │
                                                                                    Rejection → Rework / Replacement / Return-Credit
                                                                                    (still traceable to original Vendor PO line)

Sales Order ──1:N── Dispatch (partial allowed) ──1:N── Invoice ──1:N── Payment

Stock Ledger: keyed by Part + Location + Batch, tagged with source Order Line for traceability.
Rejected stock is a distinct status — never auto-reverts to "available."
```

---

## 4. Status State Machines (representative)

**Sales Order:** Draft → Received → Processing → Partially Dispatched → Completed → Closed

**Vendor PO:** Draft → *(RFQ Sent → Quoted → Approved — only if that vendor uses the formal route)* → Issued → Partially Received → Received → Closed

**Production Stage (per Order Line):** Pending → In Progress → Done → Inspected → *(Rejected → Rework / Replace)*

**Order Line:** Not Started → In Production / With Vendor → Ready → Dispatched

Every state transition is written to the entity's Status History log (who, when, from/to).

---

## 5. Alerting Logic (v1)

Alert timing is **configurable per alert type** (not one universal rule) — each trigger has its own threshold(s) and frequency, stored as settings rather than hardcoded.

| Trigger | Condition | Timing | Recipient |
|---|---|---|---|
| Bid Submission due | Bid Submission Due Date approaching | Daily 9:00 AM, Alert 1 at 7 days before, Alert 2 at 3 days before — to 5 email IDs | Bid/Sales team + Admin |
| Payment overdue / approaching | Invoice due date approaching | **Confirmed:** daily 9:30 AM, every day of the week, no holidays. Alert 1 at 7 days before due date, Alert 2 at 3 days before due date (e.g. due 8th → Alert 1 on 1st, Alert 2 on 5th) | Accounts + Admin |
| Vendor delivery delay | Vendor PO due date approaching | **Confirmed:** same pattern — 7-day and 3-day-before alerts, daily 9:30 AM | Purchase + Admin |
| Delivery due date approaching | Work Order delivery period approaching | **Confirmed:** same pattern — 7-day and 3-day-before alerts, daily 9:30 AM | Sales + Admin |
| Lab result pending/failed | Lab Result not yet entered, or Failed | **Confirmed:** same pattern — 7-day and 3-day-before alerts, daily 9:30 AM | Purchase/Quality + Admin |

---

## 6. Dashboard & Monthly Review (v1)

- Open orders by status, overdue orders, vendor delivery performance, pending payments (receivable/payable), production stage bottlenecks, rejection rate by vendor/part.
- Monthly Review = a filtered/exportable snapshot of the above for management, not a separate data entry module.

---

## 7. Auth & Security (confirmed spec)

**Role hierarchy:**
- **Superadmin** (one only) — full system access; creates Module Admins; **exclusively holds user login management** (add/modify/delete user accounts — module admins do not have this).
- **Module Admins** — assign module-specific permissions to users within their own module only; cannot create/modify/delete login accounts.
- **Users** — assigned specific module access by Superadmin or their Module Admin; must log in for any action, no anonymous/shared access.

**Confirmed roster:**

| Name | Role | Email |
|---|---|---|
| Jacob Kuriakose | Proprietor — Superadmin | arieckal.industries@gmail.com |
| Gurunath Mumbaikar | Admin — Head Production | mumbaikar@arieckalindustries.com |
| Prathmesh M | Admin — Design Engineer | design2@arieckalindustries.com |
| Amita | Accounts & Purchase | accounts@arieckalindustries.com |

**Login & credentials:**
- Username is always the user's email id (can differ from their official work email).
- Password reset required every 180 days, via emailed link.
- Forgot-password flow is email-only (no SMS/security-question fallback).

**Bot protection:**
- Checkbox captcha on every login.
- Text-based captcha on password reset and other major/sensitive actions.

**General:** since this is internet-facing (not on an internal network), it needs to be hardened against external/automated attacks — standard practices apply: rate-limiting login attempts, hashed+salted passwords, HTTPS-only, session expiry. Deployment itself should stay simple — installable/deployable with minimal manual steps as part of the setup procedure the team leader (admin) will own.

---

## 8. Open Items — All Resolved ✅

Every item that was pending is now confirmed: user roster & permissions, GST invoice format, rework/replacement handling, Client Master fields, alert timing, cross-browser support, and auth/security spec. This document reflects the full v1 scope as discussed.

---

## 9. Screen List (per module)

Each row is one screen. "List" screens are filterable/sortable tables with search; "Form" screens are add/edit views; "Detail" screens are read-only drill-downs.

**Tender / Bid**
- Bid List (filter: status, result, due date range)
- Bid Form (add/edit — Order_id, Item, Qty, Bid Submission Due Date, Bid Status, Result, PO Id, Tender Id, Notes)

**Master Data**
- Client List + Client Form (fields per Section 2 — editable by Superadmin)
- Vendor List + Vendor Form (VN-0000 format, contact, GSTIN, category, rating)
- Part Master List + Part Form (PN-0000, description, unit, BOM link)
- User Management (Superadmin only) — list, add/edit/deactivate user, assign module access

**Sales / Order**
- Work Order List (filter: client, status, delivery period, payment status)
- Work Order Form (PO Id link, Client, Item, Qty, Rate, Value, Delivery Period, Deductions)
- Work Order Detail (full trace: linked Bid → PO → Production → Dispatch → Invoice)

**Purchase**
- Vendor Enquiry / Quotation List + Form
- Vendor PO List (filter: vendor, status, delivery due)
- Vendor PO Form (line items, rejection/replacement line entry)
- Receipt & Lab Entry Form (Lab Name, Result, Report No.)

**Stores / Inventory**
- Stock Ledger List (filter: part, work order)
- Stock Entry Form (Purchase Qty in, Issued Qty out — auto-calculates Net Balance)

**Production**
- Production Board (Work Order list with stage status: Raw Mtrl / Assembly / Ready for Inspection)
- Production Update Form (per Work Order — mark stage complete, flag material shortfall)

**Quality**
- Lab Result List (Pass/Fail filter)
- (Entry happens inline within Purchase's Receipt & Lab Entry Form — no separate entry screen needed)

**Dispatch / Accounts**
- Dispatch Form (partial dispatch, links to Work Order)
- Invoice Generator (auto-fills from Work Order + Dispatch, produces the confirmed PDF layout)
- Payment Tracking List (status: Paid/Partially Paid/Unpaid/Overdue, deductions)

**Management / Control**
- Dashboard (open orders, overdue items, vendor performance, pending payments, rejection rates)
- Monthly Review (filtered/exportable snapshot)
- Alert Settings (Superadmin-configurable thresholds per trigger type)

**Shared / System**
- Login (email + password + checkbox captcha)
- Forgot Password (email link)
- Password Reset (text captcha)
- Status History viewer (per record, drill-down from any Detail screen)

**Next step:** build v1 starting with Master Data + Auth (foundation everything else depends on), then Tender/Bid → Sales → Purchase → Production → Stores → Dispatch/Accounts → Dashboard, in that order.

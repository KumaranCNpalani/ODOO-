# AssetFlow: Enterprise IT Asset & Custody Management

AssetFlow is a next-generation IT asset management registry and custody tracking system designed for organizations to catalog hardware, assign custodians, handle checkouts, manage bookings, orchestrate repairs, and run cyclical audit verifications.

* **Live Deployment URL**: [https://odoo-assetflow-xi.vercel.app/login](https://odoo-assetflow-xi.vercel.app)

* Admin: admin@company.com / adminpassword
* Normal: priya@company.com / employeepassword
* Normal: sami@company.com / employeepassword
  
---

##  Key Features

### 1. Assets Directory
* Catalog organizational resources with unique serial numbers, acquisition metrics, locations, and conditions.
* Sequential tag generation (e.g., `AF-0001`, `AF-0002`) on registration.
* Categorization schemas allowing customizable metadata attributes per category (e.g. storage size, processing power, serial ranges).

### 2. Custody Allocations & Transfers
* Allocate hardware checkouts to specific employees or departments with return schedules.
* Double-allocation locks preventing checkout conflicts.
* Peer-to-peer transfer request pipeline with management approval routing.

### 3. Shared Resource Booking
* Timeline scheduling board showing resource reservations.
* Instant booking of checkable conference rooms, test devices, and pool vehicles.
* Overlap validation locks ensuring double-bookings are avoided.

### 4. Maintenance & Kanban repairs
* Multi-state Kanban board tracking hardware issues.
* Technician assignment dropdowns and resolution logs.
* Automates asset state transitions (e.g. sets asset status to `UNDER_MAINTENANCE` upon approval and restores to `AVAILABLE` on resolution).

### 5. Physical Audit Cycles
* Launches auditor-assigned verification checklist sessions.
* Real-time discrepancy reporting for damaged or missing items.
* Audit history tracking detailing verified/missing/damaged statistics.

### 6. Bulk CSV Import & Exports
* **Employees CSV Import**: Columns: `Name, Email, Role, Department`. Automatically provisions default secure temporary passwords (`Welcome@AssetFlow2026`).
* **Assets CSV Import**: Columns: `Name, Category, Serial Number, Cost, Location, Bookable`.
* **Export CSV utilities** available on the Assets Directory, Setup Tab, Allocations, Bookings, Maintenance Kanban, and Active Audit checklists.

### 7. SMTP Email Alert Triggers
* **Custody Actions**: Sends checkout receipts and returned check-in confirmations.
* **Transfers**: Alerts target employees when transfers are requested, approved, or rejected.
* **Reservations**: Confirmation emails on booking slots and cancellation notices.
* **Repairs**: Technician assignment assignments and resolution confirmations.
* **Audits**: Launches auditor alerts with checklists.

---

## Technology Stack
* **Framework**: Next.js 16 (App Router, Server Actions, React 19)
* **Styling**: Tailwind CSS v4, Lucide React icons, Recharts
* **Database**: Prisma ORM, MySQL (relational database engine)
* **Emailing**: Nodemailer with SMTP transporter config

---

## Local Setup & Development

### 1. Configure Environment variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="mysql://your_user:your_password@your_host:3306/your_database"
JWT_SECRET="your-jwt-signing-secret"

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_smtp_email
SMTP_PASS=your_smtp_app_password
```

### 2. Install dependencies
```bash
npm install
```

### 3. Bootstrap database schemas & Seed data
Running the application dev server will automatically run the schema initialization checks:
```bash
npm run dev
```

### 4. Build for production
```bash
npm run build
npm run start
```

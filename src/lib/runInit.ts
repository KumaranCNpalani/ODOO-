import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

// Simple parser for .env file to ensure connection URL is loaded in standalone script
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || '';
          if (val.length > 0 && val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
            val = val.substring(1, val.length - 1);
          }
          process.env[key] = val;
        }
      });
    }
  } catch (err) {
    console.error('Failed to parse .env file:', err);
  }
}

loadEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing from .env');
  process.exit(1);
}

async function run() {
  console.log('Connecting to cPanel MySQL database...');
  const connection = await mysql.createConnection(connectionString!);

  try {
    console.log('Creating tables (only with odoo_assetflow_ prefix, other tables will NOT be affected)...');

    // 1. Departments
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_departments (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        parent_department_id VARCHAR(36),
        head_user_id VARCHAR(36),
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 2. Users
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'EMPLOYEE' NOT NULL,
        department_id VARCHAR(36),
        status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES odoo_assetflow_departments(id) ON DELETE SET NULL
      )
    `);

    // 3. Categories
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_asset_categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        custom_fields_schema JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Assets
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_assets (
        id VARCHAR(36) PRIMARY KEY,
        asset_tag VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category_id VARCHAR(36) NOT NULL,
        serial_number VARCHAR(255) UNIQUE,
        acquisition_date DATE NOT NULL,
        acquisition_cost DECIMAL(12, 2),
        current_condition VARCHAR(30) DEFAULT 'GOOD' NOT NULL,
        location VARCHAR(255) NOT NULL,
        status VARCHAR(30) DEFAULT 'AVAILABLE' NOT NULL,
        shared_bookable TINYINT(1) DEFAULT 0 NOT NULL,
        custom_field_values JSON,
        photo_url VARCHAR(512),
        document_urls JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES odoo_assetflow_asset_categories(id)
      )
    `);

    // 5. Allocations
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_allocations (
        id VARCHAR(36) PRIMARY KEY,
        asset_id VARCHAR(36) NOT NULL,
        allocated_to_user_id VARCHAR(36),
        allocated_to_dept_id VARCHAR(36),
        allocated_by_id VARCHAR(36) NOT NULL,
        allocation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expected_return_date TIMESTAMP NULL,
        actual_return_date TIMESTAMP NULL,
        condition_on_return VARCHAR(30),
        return_notes TEXT,
        is_active TINYINT(1) DEFAULT 1 NOT NULL,
        FOREIGN KEY (asset_id) REFERENCES odoo_assetflow_assets(id),
        FOREIGN KEY (allocated_to_user_id) REFERENCES odoo_assetflow_users(id) ON DELETE SET NULL,
        FOREIGN KEY (allocated_to_dept_id) REFERENCES odoo_assetflow_departments(id) ON DELETE SET NULL,
        FOREIGN KEY (allocated_by_id) REFERENCES odoo_assetflow_users(id)
      )
    `);

    // 6. Transfer Requests
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_transfer_requests (
        id VARCHAR(36) PRIMARY KEY,
        asset_id VARCHAR(36) NOT NULL,
        requesting_user_id VARCHAR(36) NOT NULL,
        target_user_id VARCHAR(36),
        target_dept_id VARCHAR(36),
        status VARCHAR(30) DEFAULT 'REQUESTED' NOT NULL,
        approved_by_id VARCHAR(36),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES odoo_assetflow_assets(id),
        FOREIGN KEY (requesting_user_id) REFERENCES odoo_assetflow_users(id),
        FOREIGN KEY (target_user_id) REFERENCES odoo_assetflow_users(id) ON DELETE SET NULL,
        FOREIGN KEY (target_dept_id) REFERENCES odoo_assetflow_departments(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by_id) REFERENCES odoo_assetflow_users(id) ON DELETE SET NULL
      )
    `);

    // 7. Resource Bookings
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_bookings (
        id VARCHAR(36) PRIMARY KEY,
        asset_id VARCHAR(36) NOT NULL,
        booked_by_id VARCHAR(36) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(30) DEFAULT 'UPCOMING' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES odoo_assetflow_assets(id),
        FOREIGN KEY (booked_by_id) REFERENCES odoo_assetflow_users(id)
      )
    `);

    // 8. Maintenance Requests
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_maintenance_requests (
        id VARCHAR(36) PRIMARY KEY,
        asset_id VARCHAR(36) NOT NULL,
        requested_by_id VARCHAR(36) NOT NULL,
        priority VARCHAR(30) DEFAULT 'MEDIUM' NOT NULL,
        status VARCHAR(30) DEFAULT 'PENDING' NOT NULL,
        description TEXT NOT NULL,
        photo_url VARCHAR(512),
        technician_id VARCHAR(36),
        resolution_notes TEXT,
        approved_by_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES odoo_assetflow_assets(id),
        FOREIGN KEY (requested_by_id) REFERENCES odoo_assetflow_users(id),
        FOREIGN KEY (technician_id) REFERENCES odoo_assetflow_users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by_id) REFERENCES odoo_assetflow_users(id) ON DELETE SET NULL
      )
    `);

    // 9. Audit Cycles
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_audit_cycles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        department_scope_id VARCHAR(36),
        location_scope VARCHAR(255),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(30) DEFAULT 'IN_PROGRESS' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_scope_id) REFERENCES odoo_assetflow_departments(id) ON DELETE SET NULL
      )
    `);

    // 10. Audit Auditors
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_audit_auditors (
        audit_cycle_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (audit_cycle_id, user_id),
        FOREIGN KEY (audit_cycle_id) REFERENCES odoo_assetflow_audit_cycles(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES odoo_assetflow_users(id) ON DELETE CASCADE
      )
    `);

    // 11. Audit Items
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_audit_items (
        id VARCHAR(36) PRIMARY KEY,
        audit_cycle_id VARCHAR(36) NOT NULL,
        asset_id VARCHAR(36) NOT NULL,
        status VARCHAR(30) DEFAULT 'PENDING' NOT NULL,
        verified_by_id VARCHAR(36),
        verification_notes TEXT,
        verified_at TIMESTAMP NULL,
        FOREIGN KEY (audit_cycle_id) REFERENCES odoo_assetflow_audit_cycles(id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id) REFERENCES odoo_assetflow_assets(id),
        FOREIGN KEY (verified_by_id) REFERENCES odoo_assetflow_users(id) ON DELETE SET NULL
      )
    `);

    // 12. Audit Logs
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS odoo_assetflow_audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        action VARCHAR(255) NOT NULL,
        details JSON NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES odoo_assetflow_users(id) ON DELETE SET NULL
      )
    `);

    console.log('Tables created/verified successfully!');

    // Check seed status
    const [rows]: any[] = await connection.execute(
      'SELECT id FROM odoo_assetflow_users WHERE email = ?',
      ['admin@company.com']
    );

    if (rows.length === 0) {
      console.log('Seeding default records...');
      const adminId = crypto.randomUUID();
      const samiiqbalId = crypto.randomUUID();
      const rohanmehtaId = crypto.randomUUID();
      const managerId = crypto.randomUUID();
      const priyaId = crypto.randomUUID();
      const rajId = crypto.randomUUID();

      const passwordHash = await bcrypt.hash('adminpassword', 10);
      const employeePasswordHash = await bcrypt.hash('employeepassword', 10);

      // Users
      await connection.execute(
        'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [adminId, 'System Admin', 'admin@company.com', passwordHash, 'ADMIN']
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [samiiqbalId, 'Sami Iqbal', 'sami@company.com', employeePasswordHash, 'DEPARTMENT_HEAD']
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [rohanmehtaId, 'Rohan Mehta', 'rohan@company.com', employeePasswordHash, 'DEPARTMENT_HEAD']
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [managerId, 'Sarah Connor', 'sarah@company.com', employeePasswordHash, 'ASSET_MANAGER']
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [priyaId, 'Priya Shah', 'priya@company.com', employeePasswordHash, 'EMPLOYEE']
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [rajId, 'Raj Patel', 'raj@company.com', employeePasswordHash, 'EMPLOYEE']
      );

      // Departments
      const itDeptId = crypto.randomUUID();
      const facilitiesDeptId = crypto.randomUUID();
      const fieldOpsDeptId = crypto.randomUUID();

      await connection.execute(
        'INSERT INTO odoo_assetflow_departments (id, name, head_user_id) VALUES (?, ?, ?)',
        [itDeptId, 'IT Department', samiiqbalId]
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_departments (id, name, head_user_id) VALUES (?, ?, ?)',
        [facilitiesDeptId, 'Facilities', rohanmehtaId]
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_departments (id, name, head_user_id) VALUES (?, ?, ?)',
        [fieldOpsDeptId, 'Field Ops (East)', samiiqbalId]
      );

      // Update User Department refs
      await connection.execute('UPDATE odoo_assetflow_users SET department_id = ? WHERE id = ?', [itDeptId, samiiqbalId]);
      await connection.execute('UPDATE odoo_assetflow_users SET department_id = ? WHERE id = ?', [facilitiesDeptId, rohanmehtaId]);
      await connection.execute('UPDATE odoo_assetflow_users SET department_id = ? WHERE id = ?', [itDeptId, priyaId]);
      await connection.execute('UPDATE odoo_assetflow_users SET department_id = ? WHERE id = ?', [fieldOpsDeptId, rajId]);

      // Categories
      const electronicsId = crypto.randomUUID();
      const furnitureId = crypto.randomUUID();

      await connection.execute(
        'INSERT INTO odoo_assetflow_asset_categories (id, name, description, custom_fields_schema) VALUES (?, ?, ?, ?)',
        [electronicsId, 'Electronics', 'Hardware, laptops, etc', JSON.stringify({ warranty_months: 'number', manufacturer: 'string' })]
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_asset_categories (id, name, description, custom_fields_schema) VALUES (?, ?, ?, ?)',
        [furnitureId, 'Furniture', 'Desks, chairs, rooms', JSON.stringify({ material: 'string' })]
      );

      // Assets
      const laptopId = crypto.randomUUID();
      const chairId = crypto.randomUUID();

      await connection.execute(
        'INSERT INTO odoo_assetflow_assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, current_condition, location, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [laptopId, 'AF-0012', 'Dell Latitude 5420', electronicsId, 'DL-5420-9988', '2025-01-10', 1200.00, 'GOOD', 'Bengaluru Office', 'ALLOCATED']
      );
      await connection.execute(
        'INSERT INTO odoo_assetflow_assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, current_condition, location, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [chairId, 'AF-0201', 'Office Chair', furnitureId, 'EC-CHAIR-4455', '2025-02-20', 250.00, 'GOOD', 'Warehouse A', 'AVAILABLE']
      );

      // Allocations
      await connection.execute(
        'INSERT INTO odoo_assetflow_allocations (id, asset_id, allocated_to_user_id, allocated_by_id, expected_return_date) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), laptopId, priyaId, managerId, new Date('2026-09-12')]
      );

      console.log('Seeding completed successfully!');
    } else {
      console.log('Default records already exist. Skipping seed.');
    }
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  } finally {
    await connection.end();
  }
}

run();

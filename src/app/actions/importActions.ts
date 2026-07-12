'use server';

import { query, executeTransaction } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required');
  }
  return session;
}

async function checkAssetManager() {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'ASSET_MANAGER')) {
    throw new Error('Unauthorized: Asset Manager access required');
  }
  return session;
}

// 1. Bulk Import Employees (Admin Only)
export async function importEmployeesAction(employees: Array<{
  name: string;
  email: string;
  role: string;
  departmentName: string;
}>) {
  const session = await checkAdmin();

  try {
    const passwordHash = await hashPassword('Welcome@AssetFlow2026');

    const result = await executeTransaction(async (conn) => {
      let createdCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const emp of employees) {
        if (!emp.name || !emp.email) {
          skippedCount++;
          continue;
        }

        // Verify if user already exists
        const [existing]: any[] = await conn.execute(
          'SELECT id FROM odoo_assetflow_users WHERE email = ?',
          [emp.email.trim().toLowerCase()]
        );

        if (existing.length > 0) {
          skippedCount++;
          continue;
        }

        // Auto-resolve or create department
        let departmentId: string | null = null;
        if (emp.departmentName && emp.departmentName.trim().length > 0) {
          const deptNameTrimmed = emp.departmentName.trim();
          const [depts]: any[] = await conn.execute(
            'SELECT id FROM odoo_assetflow_departments WHERE name = ? LIMIT 1',
            [deptNameTrimmed]
          );

          if (depts.length > 0) {
            departmentId = depts[0].id;
          } else {
            // Auto create active department
            departmentId = crypto.randomUUID();
            await conn.execute(
              'INSERT INTO odoo_assetflow_departments (id, name, status) VALUES (?, ?, "ACTIVE")',
              [departmentId, deptNameTrimmed]
            );
          }
        }

        // Insert new employee
        const id = crypto.randomUUID();
        const role = ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE'].includes(emp.role?.toUpperCase())
          ? emp.role.toUpperCase()
          : 'EMPLOYEE';

        await conn.execute(
          'INSERT INTO odoo_assetflow_users (id, name, email, password_hash, role, department_id, status) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")',
          [id, emp.name.trim(), emp.email.trim().toLowerCase(), passwordHash, role, departmentId]
        );
        createdCount++;
      }

      return { createdCount, skippedCount, errors };
    });

    revalidatePath('/dashboard/setup');
    return { success: true, ...result };
  } catch (error: any) {
    console.error('Import employees error:', error);
    return { success: false, message: error.message || 'Failed to import employees' };
  }
}

// 2. Bulk Import Assets (Admin & Manager)
export async function importAssetsAction(assets: Array<{
  name: string;
  categoryName: string;
  serialNumber: string | null;
  acquisitionDate: string;
  acquisitionCost: number | null;
  condition: string;
  location: string;
  sharedBookable: boolean;
}>) {
  const session = await checkAssetManager();

  try {
    const result = await executeTransaction(async (conn) => {
      let createdCount = 0;
      const errors: string[] = [];

      // Fetch categories cache
      const [categories]: any[] = await conn.execute(
        'SELECT id, name FROM odoo_assetflow_asset_categories'
      );
      const catMap = new Map<string, string>();
      categories.forEach((cat: any) => {
        catMap.set(cat.name.toLowerCase().trim(), cat.id);
      });

      // Fetch last asset tag count to calculate sequential tags
      const [lastAssets]: any[] = await conn.execute(
        'SELECT asset_tag FROM odoo_assetflow_assets ORDER BY asset_tag DESC LIMIT 1'
      );
      const lastAsset = lastAssets[0];
      let nextNum = 1;
      if (lastAsset && lastAsset.asset_tag) {
        const numMatch = lastAsset.asset_tag.match(/AF-(\d+)/);
        if (numMatch) {
          nextNum = parseInt(numMatch[1], 10) + 1;
        }
      }

      for (const asset of assets) {
        if (!asset.name || !asset.categoryName) {
          errors.push(`Row skipped: missing name or category.`);
          continue;
        }

        const catId = catMap.get(asset.categoryName.toLowerCase().trim());
        if (!catId) {
          errors.push(`Row "${asset.name}" skipped: Category "${asset.categoryName}" not found in database.`);
          continue;
        }

        // Check duplicate serial number
        if (asset.serialNumber) {
          const [existSerial]: any[] = await conn.execute(
            'SELECT id FROM odoo_assetflow_assets WHERE serial_number = ? LIMIT 1',
            [asset.serialNumber.trim()]
          );
          if (existSerial.length > 0) {
            errors.push(`Row "${asset.name}" skipped: Duplicate serial number "${asset.serialNumber}".`);
            continue;
          }
        }

        const assetTag = `AF-${String(nextNum).padStart(4, '0')}`;
        const id = crypto.randomUUID();
        const acqDate = asset.acquisitionDate ? new Date(asset.acquisitionDate) : new Date();

        await conn.execute(
          'INSERT INTO odoo_assetflow_assets (id, asset_tag, name, category_id, serial_number, acquisition_date, acquisition_cost, current_condition, location, status, shared_bookable, custom_field_values, document_urls) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "AVAILABLE", ?, ?, ?)',
          [
            id,
            assetTag,
            asset.name.trim(),
            catId,
            asset.serialNumber?.trim() || null,
            acqDate,
            asset.acquisitionCost || null,
            asset.condition || 'GOOD',
            asset.location || 'HQ Office',
            asset.sharedBookable ? 1 : 0,
            JSON.stringify({}),
            JSON.stringify([]),
          ]
        );

        nextNum++;
        createdCount++;
      }

      return { createdCount, errors };
    });

    revalidatePath('/dashboard/assets');
    return { success: true, ...result };
  } catch (error: any) {
    console.error('Import assets error:', error);
    return { success: false, message: error.message || 'Failed to import assets' };
  }
}

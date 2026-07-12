import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AssetsDirectory from './assetsDirectory';

export default async function AssetsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // Fetch categories
  const categories = await query<any>(
    'SELECT * FROM odoo_assetflow_asset_categories ORDER BY name ASC'
  );

  // Fetch assets with category name
  const rawAssets = await query<any>(
    `SELECT a.*, c.name as category_name 
     FROM odoo_assetflow_assets a 
     LEFT JOIN odoo_assetflow_asset_categories c ON a.category_id = c.id 
     ORDER BY a.asset_tag DESC`
  );

  const assets = rawAssets.map((asset: any) => ({
    ...asset,
    category: { id: asset.category_id, name: asset.category_name },
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Assets Registry</h2>
        <p className="text-sm text-muted-foreground">Search and manage organizational hardware, spaces, and equipment</p>
      </div>

      <AssetsDirectory 
        assets={assets} 
        categories={categories} 
        userRole={session.role} 
      />
    </div>
  );
}

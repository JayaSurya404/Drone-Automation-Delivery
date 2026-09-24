/**
 * SkyNav Product Catalog Audit Script
 * Verifies 100% integrity of authoritative catalog, database rows, and local image assets.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { MASTER_PRODUCTS, MASTER_CATEGORIES } from '../shared/contracts/catalog.js';

interface AuditReport {
  timestamp: string;
  totalMasterProducts: number;
  totalMasterCategories: number;
  productsWithImages: number;
  productsWithoutImages: number;
  duplicateImages: string[];
  missingDiskAssets: string[];
  customerDbProductsCount: number;
  adminDbProductsCount: number;
  dbMismatches: string[];
  allPassed: boolean;
}

function runAudit(): AuditReport {
  console.log('====================================================');
  console.log('   SKYNAV CATALOG & ASSET INTEGRITY AUDIT');
  console.log('====================================================\n');

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    totalMasterProducts: MASTER_PRODUCTS.length,
    totalMasterCategories: MASTER_CATEGORIES.length,
    productsWithImages: 0,
    productsWithoutImages: 0,
    duplicateImages: [],
    missingDiskAssets: [],
    customerDbProductsCount: 0,
    adminDbProductsCount: 0,
    dbMismatches: [],
    allPassed: true,
  };

  // 1. Audit Master Catalog Products
  const seenImages = new Set<string>();
  const productPublicDir = path.resolve(process.cwd(), 'customer/frontend/public');

  for (const p of MASTER_PRODUCTS) {
    if (!p.image || typeof p.image !== 'string' || p.image.trim() === '') {
      report.productsWithoutImages++;
      report.allPassed = false;
    } else {
      report.productsWithImages++;
    }

    // Check for duplicate images
    if (seenImages.has(p.image)) {
      report.duplicateImages.push(`Product ${p.id} (${p.name}) reuses image: ${p.image}`);
      report.allPassed = false;
    } else {
      seenImages.add(p.image);
    }

    // Check if local file exists on disk
    if (p.image.startsWith('/')) {
      const diskPath = path.join(productPublicDir, p.image);
      if (!fs.existsSync(diskPath)) {
        report.missingDiskAssets.push(`${p.id}: ${diskPath}`);
        report.allPassed = false;
      }
    }
  }

  // 2. Audit Customer SQLite Database
  const customerDbPath = path.resolve(process.cwd(), 'customer/backend/data/skynav.db');
  if (fs.existsSync(customerDbPath)) {
    const custDb = new Database(customerDbPath, { readonly: true });
    const rows: any[] = custDb.prepare('SELECT id, name, image FROM products').all();
    report.customerDbProductsCount = rows.length;

    for (const row of rows) {
      const master = MASTER_PRODUCTS.find((m) => m.id === row.id);
      if (!master) {
        report.dbMismatches.push(`Customer DB has unknown product: ${row.id}`);
        report.allPassed = false;
      } else if (master.image !== row.image) {
        report.dbMismatches.push(`Customer DB product ${row.id} image mismatch: DB=${row.image}, Master=${master.image}`);
        report.allPassed = false;
      }
    }
    custDb.close();
  } else {
    report.dbMismatches.push(`Customer DB file not found: ${customerDbPath}`);
    report.allPassed = false;
  }

  // 3. Audit Admin SQLite Database
  const adminDbPath = path.resolve(process.cwd(), 'admin/backend/data/admin.db');
  if (fs.existsSync(adminDbPath)) {
    const admDb = new Database(adminDbPath, { readonly: true });
    const rows: any[] = admDb.prepare('SELECT id, name, image FROM products').all();
    report.adminDbProductsCount = rows.length;

    for (const row of rows) {
      const master = MASTER_PRODUCTS.find((m) => m.id === row.id);
      if (!master) {
        report.dbMismatches.push(`Admin DB has unknown product: ${row.id}`);
        report.allPassed = false;
      } else if (master.image !== row.image) {
        report.dbMismatches.push(`Admin DB product ${row.id} image mismatch: DB=${row.image}, Master=${master.image}`);
        report.allPassed = false;
      }
    }
    admDb.close();
  } else {
    report.dbMismatches.push(`Admin DB file not found: ${adminDbPath}`);
    report.allPassed = false;
  }

  // Print Summary Table
  console.log(`- Master Products Total:      ${report.totalMasterProducts}`);
  console.log(`- Master Categories Total:    ${report.totalMasterCategories}`);
  console.log(`- Products With Valid Image:  ${report.productsWithImages}`);
  console.log(`- Products Without Image:     ${report.productsWithoutImages}`);
  console.log(`- Duplicate Image References: ${report.duplicateImages.length}`);
  console.log(`- Missing Disk Assets:        ${report.missingDiskAssets.length}`);
  console.log(`- Customer DB Row Count:      ${report.customerDbProductsCount}`);
  console.log(`- Admin DB Row Count:         ${report.adminDbProductsCount}`);
  console.log(`- Database Mismatches:        ${report.dbMismatches.length}`);
  console.log(`\nAudit Result: ${report.allPassed ? '✅ 100% PASSED (AUDIT SUCCESSFUL)' : '❌ FAILED'}`);

  if (!report.allPassed) {
    console.error('Details of failures:');
    if (report.duplicateImages.length) console.error('Duplicate Images:', report.duplicateImages);
    if (report.missingDiskAssets.length) console.error('Missing Assets:', report.missingDiskAssets);
    if (report.dbMismatches.length) console.error('DB Mismatches:', report.dbMismatches);
    process.exit(1);
  }

  return report;
}

runAudit();

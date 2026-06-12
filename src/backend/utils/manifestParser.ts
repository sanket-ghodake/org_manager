import fs from 'fs';
import path from 'path';
import { db } from '../../database/connection';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

export interface AppManifest {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  version?: string;
  icon?: string;
  entryPoint?: string;
  entryUrl?: string;
  routingMode?: string;
  database?: {
    requiresIsolatedSchema?: boolean;
    schemaName?: string;
  };
  targetRules?: {
    verticals?: string[];
    designations?: string[];
    minJobLevel?: number;
  };
}

export interface ManifestValidationResult {
  isValid: boolean;
  errors: string[];
  manifest: AppManifest;
  folderName: string;
}

/**
 * Validates a single app manifest for required parameters:
 * - unique app slug identifier (must have `slug`)
 * - valid routingMode (e.g. must have `routingMode` and it should be non-empty)
 */
export function validateManifest(manifest: AppManifest, folderName: string): ManifestValidationResult {
  const errors: string[] = [];

  if (!manifest.slug || typeof manifest.slug !== 'string' || manifest.slug.trim() === '') {
    errors.push('Missing unique app slug identifier ("slug" property is required and must be a non-empty string)');
  }

  if (!manifest.routingMode || typeof manifest.routingMode !== 'string' || manifest.routingMode.trim() === '') {
    errors.push('Missing valid routing mode ("routingMode" property is required and must be a non-empty string)');
  }

  if (!manifest.name || typeof manifest.name !== 'string' || manifest.name.trim() === '') {
    errors.push('Missing application name ("name" property is required and must be a non-empty string)');
  }

  const entry = manifest.entryPoint || manifest.entryUrl;
  if (!entry || typeof entry !== 'string' || entry.trim() === '') {
    errors.push('Missing entry point URL or script ("entryPoint" or "entryUrl" must be a non-empty string)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    manifest,
    folderName,
  };
}

/**
 * Discovers and parses all manifests inside the apps directory.
 */
export function scanAppManifests(): ManifestValidationResult[] {
  const results: ManifestValidationResult[] = [];
  try {
    let appsDir = path.join(process.cwd(), 'src/apps');
    if (!fs.existsSync(appsDir)) {
      appsDir = path.join(process.cwd(), '../apps');
    }

    if (!fs.existsSync(appsDir)) {
      console.warn(`Apps directory not found at: ${appsDir}`);
      return [];
    }

    const items = fs.readdirSync(appsDir);
    for (const item of items) {
      const itemPath = path.join(appsDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const configPath = path.join(itemPath, 'app.json');
        if (fs.existsSync(configPath)) {
          try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const manifest = JSON.parse(configContent);
            const validation = validateManifest(manifest, item);
            results.push(validation);
          } catch (err: any) {
            results.push({
              isValid: false,
              errors: [`Failed to parse JSON file: ${err.message}`],
              manifest: {},
              folderName: item,
            });
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Error scanning app manifests:', error);
  }
  return results;
}

/**
 * Main parser pipeline: Scans apps, registers valid ones to the database,
 * logs warnings for invalid ones, and handles isolated database schema provisioning.
 */
export async function parseAndRegisterManifests(): Promise<AppManifest[]> {
  console.log('Running App Manifest Parser Pipeline...');
  const validations = scanAppManifests();
  const registeredApps: AppManifest[] = [];

  for (const validation of validations) {
    const { isValid, errors, manifest, folderName } = validation;

    if (!isValid) {
      // Flag a validation warning inside system logs
      const warningMessage = `App Manifest Validation Failure in folder "${folderName}"`;
      console.warn(`[MANIFEST PARSER WARN] ${warningMessage}. Errors: ${errors.join(', ')}`);
      
      try {
        await db.execute(sql`
          INSERT INTO system_logs (action, severity, payload)
          VALUES (
            'App Manifest Validation Failure',
            'WARN',
            ${JSON.stringify({ folderName, errors, manifest })}::jsonb
          )
        `);
      } catch (logErr) {
        console.error('Failed to log manifest validation error to database:', logErr);
      }
      continue; // Prevent app from mounting/mounting to sidebar
    }

    // Register valid application into the database
    const slug = manifest.slug!;
    const name = manifest.name!;
    const entryUrl = manifest.entryPoint || manifest.entryUrl || '';
    const isIsolated = manifest.database?.requiresIsolatedSchema ?? false;
    const targetRules = manifest.targetRules || {};

    try {
      const existingResult = await db.execute(sql`
        SELECT id FROM forge_apps WHERE slug = ${slug}
      `);
      const rows = existingResult.rows || existingResult;
      let appId: string;

      if (rows && rows.length > 0) {
        appId = rows[0].id as string;
        await db.execute(sql`
          UPDATE forge_apps 
          SET name = ${name}, entry_url = ${entryUrl}, is_isolated_lifecycle = ${isIsolated}, target_rules = ${JSON.stringify(targetRules)}::jsonb, updated_at = NOW()
          WHERE id = ${appId}
        `);
      } else {
        const insertResult = await db.execute(sql`
          INSERT INTO forge_apps (slug, name, entry_url, is_isolated_lifecycle, target_rules)
          VALUES (${slug}, ${name}, ${entryUrl}, ${isIsolated}, ${JSON.stringify(targetRules)}::jsonb)
          RETURNING id
        `);
        const insertRows = insertResult.rows || insertResult;
        appId = insertRows[0].id as string;
      }

      // Provision isolated schema namespace if required
      if (isIsolated && manifest.database?.schemaName) {
        const schemaName = manifest.database.schemaName;
        if (/^[a-zA-Z0-9_]+$/.test(schemaName)) {
          await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`));
          
          const storageResult = await db.execute(sql`
            SELECT id FROM forge_app_storage WHERE app_id = ${appId} OR custom_schema_namespace = ${schemaName}
          `);
          const storageRows = storageResult.rows || storageResult;
          if (!storageRows || storageRows.length === 0) {
            await db.execute(sql`
              INSERT INTO forge_app_storage (app_id, custom_schema_namespace, allow_base_read_access)
              VALUES (${appId}, ${schemaName}, false)
            `);
          }
        }
      }

      registeredApps.push(manifest);
      console.log(`[MANIFEST PARSER INFO] Registered app: ${name} (${slug})`);
    } catch (dbErr) {
      console.error(`Failed to register valid app "${name}" to database:`, dbErr);
    }
  }

  // Also clean up any registered apps in the database that are no longer present on disk or no longer valid
  try {
    const currentValidSlugs = registeredApps.map(app => app.slug!);
    const appsResult = await db.execute(sql`SELECT slug, id FROM forge_apps`);
    const dbApps = appsResult.rows || appsResult;
    for (const dbApp of dbApps) {
      const dbSlug = dbApp.slug as string;
      if (!currentValidSlugs.includes(dbSlug)) {
        console.log(`[MANIFEST PARSER INFO] Removing obsolete/invalid app from database registry: ${dbSlug}`);
        await db.execute(sql`DELETE FROM forge_app_storage WHERE app_id = ${dbApp.id}`);
        await db.execute(sql`DELETE FROM forge_apps WHERE id = ${dbApp.id}`);
      }
    }
  } catch (cleanErr) {
    console.error('Failed to cleanup obsolete registered apps:', cleanErr);
  }

  return registeredApps;
}

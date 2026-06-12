import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateManifest } from '../../../../backend/utils/manifestParser';
import { db } from '../../../../database/connection';
import { sql } from 'drizzle-orm';

function getAppsDirectory(): string {
  let appsDir = path.join(process.cwd(), 'src/apps');
  if (!fs.existsSync(appsDir)) {
    appsDir = path.join(process.cwd(), '../apps');
  }
  return appsDir;
}

export async function GET() {
  try {
    const appsDir = getAppsDirectory();
    
    if (!fs.existsSync(appsDir)) {
      return NextResponse.json({ apps: [] });
    }

    const items = fs.readdirSync(appsDir);
    const discoveredApps = [];

    for (const item of items) {
      const itemPath = path.join(appsDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const configPath = path.join(itemPath, 'app.json');
        if (fs.existsSync(configPath)) {
          try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            // Validate manifest
            const validation = validateManifest(config, item);
            if (validation.isValid) {
              discoveredApps.push({
                ...config,
                directoryName: item,
              });
            } else {
              console.warn(`[API APPS GET] Skipping invalid manifest in ${item}: ${validation.errors.join(', ')}`);
            }
          } catch (err) {
            console.error(`Error parsing app config for ${item}:`, err);
          }
        }
      }
    }

    return NextResponse.json({ apps: discoveredApps });
  } catch (error: any) {
    console.error('App discovery error:', error);
    return NextResponse.json({ error: 'Failed to discover applications' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const manifest = await request.json();
    
    const id = manifest.id || manifest.slug;
    if (!id) {
      return NextResponse.json({ error: 'Manifest must contain a unique ID or slug' }, { status: 400 });
    }

    // Validate using core validator
    const validation = validateManifest(manifest, id);
    if (!validation.isValid) {
      // Log validation failure in system logs
      try {
        await db.execute(sql`
          INSERT INTO system_logs (action, severity, payload)
          VALUES (
            'App Manifest Validation Failure (POST)',
            'WARN',
            ${JSON.stringify({ folderName: id, errors: validation.errors, manifest })}::jsonb
          )
        `);
      } catch (logErr) {
        console.error('Failed to log manifest validation error on POST:', logErr);
      }
      return NextResponse.json({ error: `Manifest validation failed: ${validation.errors.join(', ')}` }, { status: 400 });
    }

    const appsDir = getAppsDirectory();
    if (!fs.existsSync(appsDir)) {
      fs.mkdirSync(appsDir, { recursive: true });
    }

    const appFolder = path.join(appsDir, id);
    if (!fs.existsSync(appFolder)) {
      fs.mkdirSync(appFolder, { recursive: true });
    }

    fs.writeFileSync(
      path.join(appFolder, 'app.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Trigger database sync
    const { parseAndRegisterManifests } = await import('../../../../backend/utils/manifestParser');
    await parseAndRegisterManifests();

    return NextResponse.json({ success: true, message: `Manifest registered successfully under ${id}` });
  } catch (error: any) {
    console.error('Manifest upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload manifest' }, { status: 500 });
  }
}


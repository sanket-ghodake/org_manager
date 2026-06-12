import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const appsDir = path.join(process.cwd(), '../apps');
    
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
            
            // Add relative paths/metadata
            discoveredApps.push({
              ...config,
              directoryName: item,
            });
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

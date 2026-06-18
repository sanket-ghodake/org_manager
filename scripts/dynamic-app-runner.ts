// scripts/dynamic-app-runner.ts
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

if (process.env.RUNNING_IN_DOCKER === 'true') {
  console.log('[App Runner] Running in Docker mode. Microservices are managed as separate Docker containers. Native runner disabled.');
  process.exit(0);
}

const appsDir = path.resolve(process.cwd(), 'sandbox/apps');

const activeProcesses: { slug: string; process: ChildProcess }[] = [];

// Clean up all spawned app processes on exit
function cleanup() {
  console.log('\n[App Runner] Stopping all background microservices...');
  for (const { slug, process } of activeProcesses) {
    try {
      console.log(`[App Runner] Killing process for ${slug} (PID: ${process.pid})`);
      process.kill('SIGTERM');
    } catch (err) {
      // ignore
    }
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});

// Run a command
function startAppServer(slug: string, cmd: string, args: string[], cwd: string) {
  console.log(`[App Runner] Starting server for "${slug}" in ${cwd} via: ${cmd} ${args.join(' ')}`);
  
  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    env: { ...process.env, PORTAL_URL: process.env.PORTAL_URL || 'http://localhost:3001' }
  });

  const logFile = path.join(cwd, 'app.log');
  // Clear file first or open in write mode
  fs.writeFileSync(logFile, '');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  proc.stdout?.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line) {
        console.log(`[App: ${slug}] ${line}`);
        logStream.write(`${new Date().toISOString()} [INFO] ${line}\n`);
      }
    }
  });

  proc.stderr?.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line) {
        console.error(`[App: ${slug}] [ERROR] ${line}`);
        logStream.write(`${new Date().toISOString()} [ERROR] ${line}\n`);
      }
    }
  });

  proc.on('close', (code) => {
    console.log(`[App Runner] App "${slug}" exited with code ${code}`);
  });

  activeProcesses.push({ slug, process: proc });
}

function startAppByPath(appPath: string) {
  if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) return;

  const manifestPath = path.join(appPath, 'app.json');
  if (!fs.existsSync(manifestPath)) return;

  let manifest: any = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    console.error(`[App Runner] Failed to parse app.json in ${path.basename(appPath)}`);
    return;
  }

  const slug = manifest.slug || path.basename(appPath);

  // Avoid launching duplicate processes for the same app slug
  const alreadyRunning = activeProcesses.some(p => p.slug === slug);
  if (alreadyRunning) return;

  // Check if manifest has custom run/dev command
  const customCommand = isDev 
    ? (manifest.devCommand || manifest.runCommand) 
    : manifest.runCommand;

  if (customCommand) {
    const parts = customCommand.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    startAppServer(slug, cmd, args, appPath);
    return;
  }

  // Auto-detect files
  if (fs.existsSync(path.join(appPath, 'server.ts'))) {
    if (isDev) {
      startAppServer(slug, 'bun', ['--watch', 'server.ts'], appPath);
    } else {
      startAppServer(slug, 'bun', ['server.ts'], appPath);
    }
  } else if (fs.existsSync(path.join(appPath, 'server.js'))) {
    startAppServer(slug, 'node', ['server.js'], appPath);
  } else if (fs.existsSync(path.join(appPath, 'server.py'))) {
    startAppServer(slug, 'python3', ['server.py'], appPath);
  } else if (fs.existsSync(path.join(appPath, 'main.py'))) {
    startAppServer(slug, 'python3', ['main.py'], appPath);
  } else if (fs.existsSync(path.join(appPath, 'main.go'))) {
    // In production inside docker, check if precompiled binary exists
    const prodBin = path.join(appPath, `${slug}-bin`);
    if (!isDev && fs.existsSync(prodBin)) {
      startAppServer(slug, prodBin, [], appPath);
    } else {
      startAppServer(slug, 'go', ['run', 'main.go'], appPath);
    }
  }
}

function scanAndStartApps() {
  if (!fs.existsSync(appsDir)) {
    console.warn(`[App Runner] Apps directory not found: ${appsDir}`);
    return;
  }

  const items = fs.readdirSync(appsDir);
  for (const item of items) {
    try {
      startAppByPath(path.join(appsDir, item));
    } catch (err) {
      console.error(`[App Runner] Error loading app ${item}:`, err);
    }
  }
}

console.log('[App Runner] Scanning and initiating dynamic sandboxed application servers...');
scanAndStartApps();

// Watch appsDir for newly added folders/apps at runtime
if (fs.existsSync(appsDir)) {
  console.log(`[App Runner] Watching directory for runtime integrations: ${appsDir}`);
  fs.watch(appsDir, { recursive: false }, (eventType, filename) => {
    if (filename) {
      const appPath = path.join(appsDir, filename);
      // Debounce and delay slightly to allow files (like app.json) to be written
      setTimeout(() => {
        try {
          if (fs.existsSync(appPath) && fs.statSync(appPath).isDirectory()) {
            startAppByPath(appPath);
          }
        } catch (e) {
          // ignore transient filesystem checks
        }
      }, 500);
    }
  });
}

// Keep process alive
setInterval(() => {}, 1000);

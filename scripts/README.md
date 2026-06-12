# Orchestration Scripts (`scripts/`)

This directory contains cross-platform convenience wrappers to initialize the development environment and boot the dev server.

## Scripts list:
* **`setup.sh` / `setup.bat`:** Automatically pulls down the local portable Bun binary (version 1.2.0), executes `bun install` for package dependencies, and boots the PostgreSQL database migration/seeding routines.
* **`run.sh` / `run.bat`:** Exports the portable Bun binary path and launches the frontend Next.js dev server.

## Troubleshooting:
### Port 3001 is Already in Use (`EADDRINUSE`)
If the development server fails to start because port 3001 is already in use, you can free the port. Sometimes, child processes or the parent Bun manager process remain alive in the background. Follow these steps to completely tear down the server and bring it back up:

#### 1. Stop the server completely (Linux/macOS)
Run the following commands to kill the listening process and clean up any dangling Next.js/Bun process trees:
```bash
# Kill process listening on port 3001
lsof -t -i:3001 | xargs -r kill -9

# Terminate any remaining Next/Bun dev server processes
pkill -f "next dev" || true
pkill -f "next-server" || true
```
Alternatively, you can use `fuser` to kill anything bound to the port:
```bash
fuser -k 3001/tcp
```

#### 2. Stop the server completely (Windows Command Prompt)
Run:
```cmd
for /f "tokens=5" %a in ('netstat -aon ^| findstr 3001') do taskkill /f /pid %a
taskkill /f /im node.exe
```

#### 3. Start the server again
Once the ports are free, restart the server by running:
```bash
bash scripts/run.sh
```

## Rules to Follow:
1. **Portable Paths:** Do not add absolute environment pathing in script lines. All relative paths should compute from the project's root folder.
2. **Cross-Platform Parity:** If you update shell logic inside the `.sh` scripts, verify you replicate the corresponding adjustments in the `.bat` scripts to maintain Windows comparability.

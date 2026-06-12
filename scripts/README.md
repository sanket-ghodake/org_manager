# Orchestration Scripts (`scripts/`)

This directory contains cross-platform convenience wrappers to initialize the development environment and boot the dev server.

## Scripts list:
* **`setup.sh` / `setup.bat`:** Automatically pulls down the local portable Bun binary (version 1.2.0), executes `bun install` for package dependencies, and boots the PostgreSQL database migration/seeding routines.
* **`run.sh` / `run.bat`:** Exports the portable Bun binary path and launches the frontend Next.js dev server.

## Troubleshooting:
### Port 3001 is Already in Use (`EADDRINUSE`)
If the development server fails to start because port 3001 is already in use, you can free the port using the following command on Linux/macOS:
```bash
lsof -t -i:3001 | xargs -r kill -9
```
Or on Windows (Command Prompt):
```cmd
for /f "tokens=5" %a in ('netstat -aon ^| findstr 3001') do taskkill /f /pid %a
```
After running the command to free the port, restart the server by running:
```bash
bash scripts/run.sh
```

## Rules to Follow:
1. **Portable Paths:** Do not add absolute environment pathing in script lines. All relative paths should compute from the project's root folder.
2. **Cross-Platform Parity:** If you update shell logic inside the `.sh` scripts, verify you replicate the corresponding adjustments in the `.bat` scripts to maintain Windows comparability.

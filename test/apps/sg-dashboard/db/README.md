# SG Dashboard Database

This directory houses the database management client and schema setup logic.

## Contents

- `client.ts`: Database client instantiation using `@libsql/client` and automatic schema setup.
- `local.db`: SQLite database file generated locally during development (added to `.gitignore` / mounted via docker volumes).

# TRR Strategy SG_Dashboard App

This is a Forge Application for TRR Strategy (Technical Resource Review). It is developed using Fastify, Bun, and libSQL/SQLite database engine.

## Directory Structure

```
sg-dashboard/
├── Dockerfile                  # Application deployment config
├── docker-compose.yml          # isolated docker service orchestration
├── package.json                # Project configurations & dependencies
├── README.md                   # Main documentation
│
├── db/                         # Database connection & schema initializer
│   ├── README.md
│   ├── client.ts
│   └── local.db
│
├── backend/                    # Fastify API Server
│   ├── README.md
│   ├── server.ts
│   ├── config.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── config.ts
│   │   ├── dashboard.ts
│   │   ├── submissions.ts
│   │   └── team.ts
│   └── utils/
│       └── hierarchy.ts
│
└── frontend/                   # Client interface assets
    ├── README.md
    ├── index.html
    ├── styles.css
    └── js/
        ├── api.js
        ├── ui.js
        └── app.js
```

## Setup & Running

Start the dashboard app in docker compose locally:
```bash
./test/scripts/run-sg-dashboard.sh
```

Or run the backend server with Bun directly:
```bash
bun install
bun run backend/server.ts
```

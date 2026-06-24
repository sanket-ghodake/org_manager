# SG Dashboard Backend

This directory houses the backend server logic, APIs, middlewares, and helper utilities.

## Directory Structure

- `server.ts`: The main entrypoint that initializes Fastify, registers plugins/middlewares, maps the static frontend folder, registers API routes, and binds to the designated port.
- `config.ts`: Environment variable loader & export constants.
- `middleware/`: Contains route guard decorators (like JWT authentication).
- `routes/`: Contains modular route handlers grouped by domain feature (Auth, Configuration, Dashboards, Submissions, Team Hierarchy).
- `utils/`: Reusable helper modules (e.g. recursive organization chart path hierarchy checkers).

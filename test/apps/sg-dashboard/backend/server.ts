import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyJwt from '@fastify/jwt';
import path from 'path';
import { PORT, JWT_SECRET } from './config';
import { initDb } from './db/client';
import { registerAuthMiddleware } from './middleware/auth';

import configRoutes from './routes/config';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import teamRoutes from './routes/team';
import submissionsRoutes from './routes/submissions';

const fastify = Fastify({ logger: true });

// Register JWT plugin
fastify.register(fastifyJwt, {
  secret: JWT_SECRET,
});

// Register auth decorator middleware
registerAuthMiddleware(fastify);

// Serve static frontend files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../frontend'),
  prefix: '/',
});

// Register API Routes
fastify.register(configRoutes);
fastify.register(authRoutes);
fastify.register(dashboardRoutes);
fastify.register(teamRoutes);
fastify.register(submissionsRoutes);

// Initialize DB Tables
initDb();

// Fallback to SPA index.html
fastify.setNotFoundHandler(async (request, reply) => {
  return reply.sendFile('index.html');
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`Server is running on port ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

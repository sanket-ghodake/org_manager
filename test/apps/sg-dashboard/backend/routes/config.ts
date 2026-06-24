import { FastifyInstance } from 'fastify';
import { CLIENT_ID, PORTAL_SSO_URL } from '../config';

export default async function configRoutes(fastify: FastifyInstance) {
  fastify.get('/api/config', async (request, reply) => {
    return {
      clientId: CLIENT_ID,
      portalSsoUrl: PORTAL_SSO_URL,
    };
  });
}

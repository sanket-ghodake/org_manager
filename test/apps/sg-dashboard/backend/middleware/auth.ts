import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Add TypeScript declaration mapping for fastify.authenticate decorator
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export function registerAuthMiddleware(fastify: FastifyInstance) {
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (_err) {
        reply
          .status(401)
          .send({ error: "Unauthorized: Invalid or expired token" });
      }
    },
  );
}

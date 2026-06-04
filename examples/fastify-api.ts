import Fastify from "fastify";
import { ultraigdl } from "ultra-igdl";

const fastify = Fastify({ logger: true });
const ig = new ultraigdl({ cache: true });

fastify.get("/health", async () => ig.health());

fastify.get<{ Querystring: { url: string } }>("/download", async (request, reply) => {
  const { url } = request.query;
  if (!url) {
    return reply.status(400).send({ code: 400, message: "url required" });
  }
  const result = await ig.download(url);
  return reply.status(result.code).send(result);
});

fastify.listen({ port: 3001, host: "0.0.0.0" });
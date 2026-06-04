import { Agent, Pool } from "undici";

const DEFAULT_CONNECTIONS = 100;

let sharedAgent: Agent | null = null;
let sharedPool: Pool | null = null;

export interface PoolStats {
  connections: number;
  pending: number;
}

export function getAgent(maxConnections = DEFAULT_CONNECTIONS): Agent {
  if (!sharedAgent) {
    sharedAgent = new Agent({
      connections: maxConnections,
      pipelining: 1,
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 120_000,
      connect: { rejectUnauthorized: true },
    });
  }
  return sharedAgent;
}

export function getPool(origin = "https://www.instagram.com", maxConnections = DEFAULT_CONNECTIONS): Pool {
  if (!sharedPool) {
    sharedPool = new Pool(origin, {
      connections: maxConnections,
      pipelining: 1,
      keepAliveTimeout: 60_000,
      keepAliveMaxTimeout: 120_000,
    });
  }
  return sharedPool;
}

export function getPoolStats(): PoolStats {
  return {
    connections: DEFAULT_CONNECTIONS,
    pending: 0,
  };
}

export async function closePool(): Promise<void> {
  if (sharedPool) {
    await sharedPool.close();
    sharedPool = null;
  }
  if (sharedAgent) {
    await sharedAgent.close();
    sharedAgent = null;
  }
}
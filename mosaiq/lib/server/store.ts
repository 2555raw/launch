import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Agent, Launch } from "@/lib/types";

/**
 * Persistence boundary. The app only talks to the `Store` interface; the
 * JSON-file implementation below is enough for local use and a single
 * instance with a volume. Swap `createStore` for a Postgres/KV version to
 * scale out without touching routes or pages.
 */
export interface Store {
  listLaunches(): Promise<Launch[]>;
  getLaunch(id: string): Promise<Launch | undefined>;
  insertLaunch(launch: Launch): Promise<void>;
  updateLaunch(id: string, patch: Partial<Launch>): Promise<Launch | undefined>;
  listAgents(): Promise<Agent[]>;
  findAgentByHash(hash: string): Promise<Agent | undefined>;
  insertAgent(agent: Agent): Promise<void>;
  updateAgent(id: string, patch: Partial<Agent>): Promise<void>;
}

interface Db {
  version: 1;
  launches: Launch[];
  agents: Agent[];
}

const empty = (): Db => ({ version: 1, launches: [], agents: [] });

class JsonFileStore implements Store {
  private file: string;
  private cache: Db | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.file = path.join(dir, "mosaiq.json");
  }

  private async load(): Promise<Db> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await fs.readFile(this.file, "utf8")) as Db;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      this.cache = empty();
    }
    return this.cache;
  }

  /** Serialise writes and replace the file atomically. */
  private write<T>(fn: (db: Db) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const db = await this.load();
      const result = fn(db);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db));
      await fs.rename(tmp, this.file);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async listLaunches() {
    return [...(await this.load()).launches];
  }
  async getLaunch(id: string) {
    return (await this.load()).launches.find((l) => l.id === id);
  }
  insertLaunch(launch: Launch) {
    return this.write((db) => void db.launches.push(launch));
  }
  updateLaunch(id: string, patch: Partial<Launch>) {
    return this.write((db) => {
      const l = db.launches.find((x) => x.id === id);
      if (l) Object.assign(l, patch);
      return l ? { ...l } : undefined;
    });
  }
  async listAgents() {
    return [...(await this.load()).agents];
  }
  async findAgentByHash(hash: string) {
    return (await this.load()).agents.find((a) => a.keyHash === hash);
  }
  insertAgent(agent: Agent) {
    return this.write((db) => void db.agents.push(agent));
  }
  updateAgent(id: string, patch: Partial<Agent>) {
    return this.write((db) => {
      const a = db.agents.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    });
  }
}

const globalForStore = globalThis as unknown as { __mosaiqStore?: Store };

export function store(): Store {
  globalForStore.__mosaiqStore ??= new JsonFileStore(path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.DATA_DIR ?? ".data"));
  return globalForStore.__mosaiqStore;
}

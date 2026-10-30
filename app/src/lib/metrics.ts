import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';
import { prisma } from '@/lib/prisma';

type Metrics = {
  registry: Registry;
  projectsCreated: Counter<'source'>;
};

// Kept on globalThis so hot reloads and separate route bundles share one registry.
const globalForMetrics = globalThis as unknown as { tiscMetrics?: Metrics };

function createMetrics(): Metrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'tisc_' });

  const projectsCreated = new Counter({
    name: 'tisc_projects_created_total',
    help: 'Number of projects created since the server started',
    labelNames: ['source'] as const,
    registers: [registry],
  });

  new Gauge({
    name: 'tisc_projects_total',
    help: 'Total number of projects',
    registers: [registry],
    async collect() {
      this.set(await prisma.project.count());
    },
  });

  new Gauge({
    name: 'tisc_users_total',
    help: 'Total number of users',
    registers: [registry],
    async collect() {
      this.set(await prisma.user.count());
    },
  });

  new Gauge({
    name: 'tisc_users_disabled',
    help: 'Number of disabled users',
    registers: [registry],
    async collect() {
      this.set(await prisma.user.count({ where: { disabled: true } }));
    },
  });

  new Gauge({
    name: 'tisc_storage_bytes_total',
    help: 'Total size of all project files in bytes',
    registers: [registry],
    async collect() {
      const { _sum } = await prisma.projectFile.aggregate({ _sum: { size: true } });
      this.set(_sum.size ?? 0);
    },
  });

  return { registry, projectsCreated };
}

export const metrics = (globalForMetrics.tiscMetrics ??= createMetrics());

import { freemem, totalmem } from 'node:os';
import { app } from 'electron';
import type { MetricsSnapshot } from '../shared/api';

const MB = 1024;

/**
 * Uso real de RAM/CPU de todos os processos do Electron (main, renderer, GPU, utilitários).
 * Não inclui o `cloudflared` (processo filho próprio, ~30–50 MB) — ver docs/performance.md.
 */
export class MetricsService {
  snapshot(): MetricsSnapshot {
    const processes = app.getAppMetrics().map((p) => ({
      type: p.name ? `${p.type} (${p.name})` : p.type,
      // workingSetSize vem em KB
      memoryMB: Math.round(p.memory.workingSetSize / MB),
      cpuPercent: Math.round(p.cpu.percentCPUUsage * 10) / 10,
    }));
    return {
      appMemoryMB: processes.reduce((s, p) => s + p.memoryMB, 0),
      appCpuPercent: Math.round(processes.reduce((s, p) => s + p.cpuPercent, 0) * 10) / 10,
      processes,
      systemFreeMB: Math.round(freemem() / 1024 / 1024),
      systemTotalMB: Math.round(totalmem() / 1024 / 1024),
    };
  }
}

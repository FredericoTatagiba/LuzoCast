import type { ReadinessItem } from '../../shared/api';
import { runSafely, type ReadinessCheck } from './ReadinessCheck';

/** Composite: roda todas as verificações em paralelo e devolve na ordem de registro. */
export class ReadinessService {
  constructor(private readonly checks: readonly ReadinessCheck[]) {}

  runAll(): Promise<ReadinessItem[]> {
    return Promise.all(this.checks.map((c) => runSafely(c)));
  }
}

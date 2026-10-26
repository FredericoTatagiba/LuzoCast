import type { CheckStatus, FixAction, ReadinessItem } from '../../shared/api';

export interface CheckResult {
  status: CheckStatus;
  detail: string;
  data?: Record<string, number>;
  action?: FixAction;
}

/**
 * Uma verificação de prontidão (Strategy). Para adicionar uma nova: implemente esta
 * interface e registre-a no Composition Root (apps/host/src/main/index.ts).
 * `run` NUNCA deve lançar — falhas viram `{ status: 'fail' }`.
 */
export interface ReadinessCheck {
  readonly id: string;
  readonly label: string;
  run(): Promise<CheckResult>;
}

/** Executa um check isolando erros e aplicando timeout. */
export async function runSafely(check: ReadinessCheck, timeoutMs = 15_000): Promise<ReadinessItem> {
  const timeout = new Promise<CheckResult>((resolve) =>
    setTimeout(() => resolve({ status: 'fail', detail: 'Tempo esgotado na verificação' }), timeoutMs),
  );
  let result: CheckResult;
  try {
    result = await Promise.race([check.run(), timeout]);
  } catch (err) {
    result = { status: 'fail', detail: err instanceof Error ? err.message : String(err) };
  }
  return { id: check.id, label: check.label, ...result };
}

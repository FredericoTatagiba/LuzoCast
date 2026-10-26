import { InvalidTransitionError } from '../errors';

/** Status público da sessão (o que a UI mostra). */
export type SessionStatus = 'idle' | 'starting' | 'live' | 'stopping' | 'ended' | 'error';

/**
 * Padrão State: cada estado decide quais ações aceita e qual é o próximo estado.
 * Para adicionar um estado: crie a classe, implemente as ações válidas e
 * deixe as demais caírem no `reject` da base.
 */
export abstract class SessionState {
  abstract readonly status: SessionStatus;

  start(): SessionState {
    return this.reject('start');
  }
  ready(): SessionState {
    return this.reject('ready');
  }
  stop(): SessionState {
    return this.reject('stop');
  }
  stopped(): SessionState {
    return this.reject('stopped');
  }
  fail(): SessionState {
    return new ErrorState();
  }
  reset(): SessionState {
    return this.reject('reset');
  }

  protected reject(action: string): never {
    throw new InvalidTransitionError(this.status, action);
  }
}

export class IdleState extends SessionState {
  readonly status = 'idle' as const;
  override start(): SessionState {
    return new StartingState();
  }
}

export class StartingState extends SessionState {
  readonly status = 'starting' as const;
  override ready(): SessionState {
    return new LiveState();
  }
  override stop(): SessionState {
    return new StoppingState();
  }
}

export class LiveState extends SessionState {
  readonly status = 'live' as const;
  override stop(): SessionState {
    return new StoppingState();
  }
}

export class StoppingState extends SessionState {
  readonly status = 'stopping' as const;
  override stopped(): SessionState {
    return new EndedState();
  }
}

export class EndedState extends SessionState {
  readonly status = 'ended' as const;
  override reset(): SessionState {
    return new IdleState();
  }
  override fail(): SessionState {
    return this; // já encerrada; falhas tardias são ignoradas
  }
}

export class ErrorState extends SessionState {
  readonly status = 'error' as const;
  override reset(): SessionState {
    return new IdleState();
  }
  override stop(): SessionState {
    return new StoppingState();
  }
}

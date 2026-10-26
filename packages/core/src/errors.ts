/** Erro base de domínio. Sempre carrega um `code` estável para a UI/tradução. */
export class LuzoError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Lançado quando a máquina de estados recebe uma transição não permitida. */
export class InvalidTransitionError extends LuzoError {
  constructor(from: string, action: string) {
    super('invalid-transition', `Transição "${action}" não é permitida a partir de "${from}"`);
  }
}

export class ViewerNotFoundError extends LuzoError {
  constructor(viewerId: string) {
    super('viewer-not-found', `Viewer "${viewerId}" não existe`);
  }
}

export class RoomFullError extends LuzoError {
  constructor(max: number) {
    super('room-full', `Limite de ${max} espectadores atingido`);
  }
}

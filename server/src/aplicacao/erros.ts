// Erros da aplicação. A camada HTTP traduz cada um para um código de resposta.

export class ErroAplicacao extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ErroNaoEncontrada extends ErroAplicacao {}
export class ErroConflito extends ErroAplicacao {}
export class ErroEntradaInvalida extends ErroAplicacao {}
export class ErroIndisponivel extends ErroAplicacao {}

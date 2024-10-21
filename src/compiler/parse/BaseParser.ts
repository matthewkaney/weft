import { Expr } from "./Expr";
import { ErrorReporter } from "./Reporter";
import { ErrorToken, Token } from "../scan/Token";
import { TokenType } from "../scan/TokenType";

export class ParseError extends Error {
  constructor(readonly source: Token | Expr, message: string = "Parse error.") {
    super(message);
  }
}

export abstract class BaseParser<T> {
  private current = 0;

  constructor(private tokens: Token[], protected reporter: ErrorReporter) {}

  abstract parse(): T;

  protected match(...types: TokenType[]) {
    for (let type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }

    return false;
  }

  protected consume(type: TokenType, message: string) {
    if (this.check(type)) return this.advance();

    throw new ParseError(this.peek(), message);
  }

  protected check(type: TokenType) {
    if (this.isAtEnd()) return false;
    return this.peek().type == type;
  }

  protected advance() {
    if (!this.isAtEnd()) this.current++;

    let token = this.previous();

    if (token instanceof ErrorToken) {
      throw new ParseError(token, token.message);
    }

    if (token.type === TokenType.UnusedKeyword) {
      throw new ParseError(
        token,
        `Haskell keyword "${token.lexeme}" isn't currently supported`
      );
    }

    return token;
  }

  protected isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }

  protected peek() {
    return this.tokens[this.current];
  }

  protected peekNext() {
    return this.isAtEnd()
      ? this.tokens[this.current]
      : this.tokens[this.current + 1];
  }

  protected previous() {
    return this.tokens[this.current - 1];
  }

  protected synchronize() {
    do {
      this.advance();
      if (this.previous().type == TokenType.LineBreak) return;
    } while (!this.isAtEnd());
  }
}

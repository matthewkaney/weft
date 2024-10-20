import { Token, Primitive, ErrorToken } from "./Token";
import { TokenType } from "./TokenType";

export class Scanner {
  private tokens: Token[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private lineStart = 0;

  get column() {
    return this.current - this.lineStart + 1;
  }

  constructor(private readonly source: string) {}

  scanTokens() {
    while (!this.isAtEnd()) {
      // We are at the beginning of the next lexeme.
      this.start = this.current;
      this.scanToken();
    }

    this.tokens.push(new Token(TokenType.EOF, "", null, this.current));
    return this.tokens;
  }

  private scanToken() {
    let c = this.advance();

    if (c in special) {
      this.addToken(special[c]);
    } else if (ascSymbol.has(c)) {
      // An initial colon means we have a constructor symbol (not used)
      c !== ":" ? this.symbolOrComment() : this.conSymbol();
    } else if (c === ":") {
      // Special constructor symbols not in use here yet
      this.conSymbol();
    } else if (c === " " || c === "\r" || c === "\t") {
      // Ignore whitespace.
    } else if (c === "\n") {
      if (!this.peek().match(/[ \r\t]/)) {
        this.addToken(TokenType.LineBreak);
      }
      this.advanceLine();
    } else if (c === '"') {
      this.string();
    } else if (this.isDigit(c)) {
      this.number();
    } else if (this.isAlpha(c)) {
      this.identifier();
    } else {
      this.addErrorToken(`Unexpected character "${c}".`);
    }
  }

  private symbolOrComment() {
    while (ascSymbol.has(this.peek())) {
      this.advance();
    }

    // Check for reserved symbols
    const string = this.source.slice(this.start, this.current);
    if (/^---*$/.test(string)) {
      // If the symbol matches the token "dashes",
      // then consume a single-line comment
      while (this.peek() != "\n" && !this.isAtEnd()) this.advance();
    } else if (string === "@") {
      // Check for source literal
      if (this.peek() === "{") {
        // Consume source literal
        this.codeLiteral();
      }
    } else if (string in reservedop) {
      this.addToken(reservedop[string]);
    } else {
      this.addToken(TokenType.Operator);
    }
  }

  private codeLiteral() {
    // At this point we've consumed the initial @
    this.advance(); // Consume the opening brace

    let braces = 1;

    while (braces > 0) {
      if (this.isAtEnd()) {
        this.addErrorToken("Unterminated code literal.");
        return;
      }

      let next = this.advance();

      if (next === "{") {
        braces += 1;
      } else if (next === "}") {
        braces -= 1;
      } else if (next === "\n") {
        this.advanceLine();
      }
    }

    // Trim the "@{" from the beginning and the "}" from the end
    let code = this.source.substring(this.start + 2, this.current - 1);

    this.addToken(TokenType.CodeLiteral, code);
  }

  private conSymbol() {
    while (ascSymbol.has(this.peek())) {
      this.advance();
    }

    // Check for reserved symbols
    const string = this.source.slice(this.start, this.current);
    if (string in reservedop) {
      this.addToken(reservedop[string]);
    } else {
      this.addToken(TokenType.ConSymbol);
    }
  }

  private identifier() {
    while (this.isAlphaNumeric(this.peek())) this.advance();

    // Check for reserved identifiers
    const string = this.source.slice(this.start, this.current);
    if (string in reserved) {
      this.addToken(reserved[string]);
    } else {
      this.addToken(TokenType.Identifier);
    }
  }

  private number() {
    while (this.isDigit(this.peek())) this.advance();

    // Look for a fractional part.
    if (this.peek() == "." && this.isDigit(this.peekNext())) {
      // Consume the "."
      this.advance();

      while (this.isDigit(this.peek())) this.advance();
    }

    this.addToken(
      TokenType.Number,
      parseFloat(this.source.substring(this.start, this.current))
    );
  }

  private string() {
    while (this.peek() != '"' && !this.isAtEnd()) {
      let c = this.advance();
      if (c === "\n") this.advanceLine();
    }

    if (this.isAtEnd()) {
      this.addErrorToken("Unterminated string.");
      return;
    }

    // The closing ".
    this.advance();

    // Trim the surrounding quotes.
    const value = this.source.substring(this.start + 1, this.current - 1);
    this.addToken(TokenType.String, value);
  }

  private match(expected: string) {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) != expected) return false;

    this.current++;
    return true;
  }

  private peek() {
    if (this.isAtEnd()) return "\0";
    return this.source.charAt(this.current);
  }

  private peekNext() {
    if (this.current + 1 >= this.source.length) return "\0";
    return this.source.charAt(this.current + 1);
  }

  private isAlpha(c: string) {
    return !!c.match(/^[a-zA-Z_]$/);
  }

  private isAlphaNumeric(c: string) {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isDigit(c: string) {
    return !!c.match(/^[0-9]$/);
  }

  private isAtEnd() {
    return this.current >= this.source.length;
  }

  private advance() {
    return this.source.charAt(this.current++);
  }

  private advanceLine() {
    this.line += 1;
    this.lineStart = this.current;
  }

  private addToken(type: TokenType, literal: Primitive = null) {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(new Token(type, text, literal, this.start));
  }

  private addErrorToken(message: string) {
    const text = this.source.substring(this.start, this.current);
    this.tokens.push(new ErrorToken(text, this.start, message));
  }
}

// Symbols that can be used in (`ascSymbol` in the Haskell report)
const ascSymbol = new Set([
  "!",
  "#",
  "$",
  "%",
  "&",
  "*",
  "+",
  ".",
  "/",
  "<",
  "=",
  ">",
  "?",
  "@",
  "\\",
  "^",
  "|",
  "-",
  "~",
  ":",
]);

const special = {
  "(": TokenType.LeftParen,
  ")": TokenType.RightParen,
  ",": TokenType.Comma,
  ";": TokenType.Semicolon,
  "[": TokenType.LeftBracket,
  "]": TokenType.RightBracket,
  "`": TokenType.Backtick,
  "{": TokenType.LeftBrace,
  "}": TokenType.RightBrace,
};

// Reserved operators. Unused operators are mapped to an error
// token.
const reservedop = {
  "..": TokenType.DotDot,
  ":": TokenType.Colon,
  "::": TokenType.ColonColon,
  "=": TokenType.Equal,
  "\\": TokenType.Backslash,
  "|": TokenType.Pipe,
  "<-": TokenType.BackArrow,
  "->": TokenType.Arrow,
  "@": TokenType.At,
  "~": TokenType.Tilde,
  "=>": TokenType.DoubleArrow,
};

// Reserved identifiers. Currently all unused, so they're mapped
// to a single error token
const reserved = {
  case: TokenType.UnusedKeyword,
  class: TokenType.UnusedKeyword,
  data: TokenType.UnusedKeyword,
  default: TokenType.UnusedKeyword,
  deriving: TokenType.UnusedKeyword,
  do: TokenType.UnusedKeyword,
  else: TokenType.UnusedKeyword,
  if: TokenType.UnusedKeyword,
  import: TokenType.UnusedKeyword,
  in: TokenType.UnusedKeyword,
  infix: TokenType.UnusedKeyword,
  infixl: TokenType.UnusedKeyword,
  infixr: TokenType.UnusedKeyword,
  instance: TokenType.UnusedKeyword,
  let: TokenType.UnusedKeyword,
  module: TokenType.UnusedKeyword,
  newtype: TokenType.UnusedKeyword,
  of: TokenType.UnusedKeyword,
  then: TokenType.UnusedKeyword,
  type: TokenType.UnusedKeyword,
  where: TokenType.UnusedKeyword,
  _: TokenType.UnusedKeyword,
};

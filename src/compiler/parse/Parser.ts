import { BaseParser } from "./BaseParser";

import { Operators } from "./API";

import { Token } from "../scan/Token";
import { TokenType } from "../scan/TokenType";

import { Expr } from "./Expr";
import { Stmt } from "./Stmt";
import { ErrorReporter } from "./Reporter";

export class Parser extends BaseParser<Stmt[]> {
  constructor(
    tokens: Token[],
    private operators: Operators,
    reporter: ErrorReporter
  ) {
    super(tokens, reporter);
  }

  parse() {
    const statements: Stmt[] = [];

    while (!this.isAtEnd()) {
      if (this.check(TokenType.LineBreak)) {
        // Ignore empty lines
        this.advance();
      } else {
        try {
          statements.push(this.bindingStatement());
        } catch (error) {
          if (error instanceof ParseError) {
            this.reporter.error(error.token, error.message);
            this.synchronize();
            break;
          } else {
            throw error;
          }
        }
      }
    }

    return statements;
  }

  private statement() {
    const expression = this.bindingStatement();

    if (!this.isAtEnd()) {
      // This surely means we've encountered an error
      if (expression.type === Expr.Type.Empty) {
        let next = this.advance();
        throw new ParseError(next, `Unexpected token "${next.lexeme}"`);
      }

      this.consume(TokenType.LineBreak, "Expect new line after expression.");
    }

    return Stmt.Expression(expression);
  }

  private bindingStatement() {
    const expression = this.expression(0);
  }

  private expression(precedence: number) {
    let left = this.application();

    while (this.peek().type === TokenType.Operator) {
      let op = this.operators.get(this.peek().lexeme);
      if (!op) {
        throw new ParseError(
          this.peek(),
          `Undefined operator "${this.peek().lexeme}"`
        );
      }
      let [opPrecedence, opAssociativity] = op;

      // If we encounter a lower-precedence operator, stop consuming tokens
      if (opPrecedence < precedence) break;

      // Check for a paren after operator, which may indicate a section
      if (this.peekNext().type === TokenType.RightParen) break;

      // Consume operator
      let operator = this.advance();
      let right = this.expression(
        opAssociativity === "left" ? opPrecedence + 1 : opPrecedence
      );

      // Check for empty expressions
      let lNull = left.type === Expr.Type.Empty;
      let rNull = right.type === Expr.Type.Empty;
      if (lNull || rNull) {
        console.log("Parse Error");
        console.log(JSON.stringify(operator));
        throw new ParseError(
          operator,
          `Missing expression ${lNull ? "before" : ""}${
            lNull && rNull ? " and " : ""
          }${rNull ? "after" : ""} the "${operator.lexeme}" operator`
        );
      }

      // Associate operator
      left = Expr.Binary(left, operator, right, opPrecedence);
    }

    return left;
  }

  private application() {
    let expr = this.grouping();

    while (this.peekFunctionTerm()) {
      let right = this.grouping();
      expr = Expr.Application(expr, right);
    }

    return expr;
  }

  private peekFunctionTerm() {
    const nextType = this.peek().type;

    return (
      nextType === TokenType.Identifier ||
      nextType === TokenType.LeftParen ||
      nextType === TokenType.LeftBracket ||
      nextType === TokenType.Number ||
      nextType === TokenType.String
    );
  }

  private grouping() {
    if (this.match(TokenType.LeftParen)) {
      let leftParen = this.previous();
      let leftOp: Token | null = null;
      let rightOp: Token | null = null;

      // Check for an initial operator
      if (this.peek().type === TokenType.Operator) {
        leftOp = this.advance();
      }

      // This is kind of a hacky way to attempt this
      if (this.match(TokenType.RightParen)) {
        if (leftOp) {
          return { type: Expr.Type.Variable, name: leftOp };
        } else {
          throw "Encountered unit literal, but unit isn't supported yet";
        }
      }

      let expr = this.expression(0);

      // Check for a trailing operator
      if (this.peek().type === TokenType.Operator) {
        rightOp = this.advance();
      }

      let rightParen = this.consume(
        TokenType.RightParen,
        "Expect ')' after expression."
      );

      if (leftOp || rightOp) {
        if (leftOp && rightOp) {
          throw new ParseError(rightParen, "Expect expression.");
        }

        let operator = leftOp ?? rightOp;
        let side: "left" | "right" = leftOp ? "left" : "right";

        let op = this.operators.get(operator.lexeme);
        if (!op) {
          throw new ParseError(
            this.peek(),
            `Undefined operator "${this.peek().lexeme}"`
          );
        }
        let [precedence] = op;

        if (expr.type === Expr.Type.Binary && expr.precedence < precedence) {
          throw new ParseError(
            operator,
            "Section operator must have lower precedence than expression"
          );
        }

        expr = Expr.Section(operator, expr, side);
      }

      return Expr.Grouping(leftParen, expr, rightParen);
    } else {
      return this.functionTerm();
    }
  }

  private functionTerm() {
    if (this.match(TokenType.Number, TokenType.String)) {
      return Expr.Literal(this.previous().literal, this.previous());
    }

    if (this.match(TokenType.Identifier)) {
      return Expr.Variable(this.previous());
    }

    if (this.match(TokenType.LeftBracket)) {
      let items: Expr[] = [];

      while (!this.match(TokenType.RightBracket)) {
        if (this.isAtEnd()) {
          throw new ParseError(this.peek(), "Unterminated list literal");
        }

        if (items.length > 0) {
          this.consume(TokenType.Comma, "Expect ',' after list items");
        }

        items.push(this.expression(0));
      }

      return Expr.List(items);
    }

    return Expr.Empty();
  }
}

import { ParseError } from "./BaseParser";

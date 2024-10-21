import { BaseParser } from "./BaseParser";

import { Operators } from "./API";

import { Token } from "../scan/Token";
import { TokenType } from "../scan/TokenType";

import { Expr, expressionBounds } from "./Expr";
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
          statements.push(this.statement());
        } catch (error) {
          if (error instanceof ParseError) {
            if ("from" in error.source) {
              this.reporter.error(error.source, error.message);
            } else {
              let { from, to } = expressionBounds(error.source);
              this.reporter.error(from, to, error.message);
            }
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
    const statement = this.declaration();

    if (!this.isAtEnd()) {
      this.consume(TokenType.LineBreak, "Expect new line after expression.");
    }

    return statement;
  }

  private declaration() {
    const expression = this.expression(0);

    if (this.peek().type === TokenType.ColonColon) {
      throw new Error("Parsing type annotations isn't supported yet");

      // if (expression.type !== Expr.Type.Variable) {
      //   throw new ParseError(
      //     expression,
      //     "Left-hand side of a type annotation needs to be a variable"
      //   );
      // }

      // let { name } = expression;
    } else if (this.peek().type === TokenType.Equal) {
      let [name, ...args] = this.parseFunlhs(expression);

      // Consume equals sign
      this.advance();

      // For now, let's just consume a single source code literal
      let initializer = this.consume(
        TokenType.CodeLiteral,
        "Right-hand sign of an assignment variable must be foreign Javascript block"
      );

      return Stmt.Binding(name, args, initializer);
    }

    return Stmt.Expression(expression);
  }

  private parseFunlhs(expr: Expr): Token[] {
    function variable(varExp: Expr): Token {
      if (varExp.type === Expr.Type.Variable) {
        return varExp.name;
      }

      throw new ParseError(
        varExp,
        "Expected variable on the left-hand side of assignment"
      );
    }

    switch (expr.type) {
      case Expr.Type.Application:
        return [...this.parseFunlhs(expr.left), variable(expr.right)];
      case Expr.Type.Binary:
      // TODO
      default:
        return [variable(expr)];
    }
  }

  private expression(precedence: number): Expr {
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

  private grouping(): Expr {
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

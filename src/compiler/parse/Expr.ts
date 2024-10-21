import { Token, Primitive } from "../scan/Token";

export type Expr =
  | { type: Expr.Type.Empty }
  | { type: Expr.Type.Assignment; name: Token; value: Expr }
  | {
      type: Expr.Type.Binary;
      left: Expr;
      operator: Token;
      right: Expr;
      precedence: number;
    }
  | {
      type: Expr.Type.Section;
      operator: Token;
      expression: Expr;
      side: "left" | "right";
    }
  | {
      type: Expr.Type.Grouping;
      leftParen: Token;
      expression: Expr;
      rightParen: Token;
    }
  | { type: Expr.Type.List; items: Expr[] }
  | { type: Expr.Type.Literal; value: Primitive; token: Token }
  | { type: Expr.Type.Unary; operator: Token; right: Expr }
  | { type: Expr.Type.Variable; name: Token }
  | { type: Expr.Type.Application; left: Expr; right: Expr };

export namespace Expr {
  export enum Type {
    Application = "Application",
    Assignment = "Assignment",
    Binary = "Binary",
    Section = "Section",
    Grouping = "Grouping",
    List = "List",
    Literal = "Literal",
    Unary = "Unary",
    Variable = "Variable",
    Empty = "Empty",
  }

  export function Application(left: Expr, right: Expr): Expr {
    return { type: Expr.Type.Application, left, right };
  }

  export function Assignment(name: Token, value: Expr): Expr {
    return { type: Expr.Type.Assignment, name, value };
  }

  export function Binary(
    left: Expr,
    operator: Token,
    right: Expr,
    precedence: number
  ): Expr {
    return { type: Expr.Type.Binary, left, operator, right, precedence };
  }

  export function Section(
    operator: Token,
    expression: Expr,
    side: "left" | "right"
  ): Expr {
    return { type: Expr.Type.Section, operator, expression, side };
  }

  export function Grouping(
    leftParen: Token,
    expression: Expr,
    rightParen: Token
  ): Expr {
    return { type: Expr.Type.Grouping, leftParen, expression, rightParen };
  }

  export function List(items: Expr[]): Expr {
    return { type: Expr.Type.List, items };
  }

  export function Literal(value: Primitive, token: Token): Expr {
    return { type: Expr.Type.Literal, value, token };
  }

  export function Unary(operator: Token, right: Expr): Expr {
    return { type: Expr.Type.Unary, operator, right };
  }

  export function Variable(name: Token): Expr {
    return { type: Expr.Type.Variable, name };
  }

  export function Empty(): Expr {
    return { type: Expr.Type.Empty };
  }
}

export function expressionBounds(expr: Expr): { to: number; from: number } {
  let from: number, to: number;
  switch (expr.type) {
    case Expr.Type.Application:
    case Expr.Type.Binary:
      return {
        from: expressionBounds(expr.left).from,
        to: expressionBounds(expr.right).to,
      };
    case Expr.Type.Assignment:
      throw new Error();
    case Expr.Type.Section:
      return expr.side === "left"
        ? { from: expr.operator.from, to: expressionBounds(expr.expression).to }
        : {
            from: expressionBounds(expr.expression).from,
            to: expr.operator.to,
          };
    case Expr.Type.Grouping:
      return { from: expr.leftParen.from, to: expr.rightParen.to };
    case Expr.Type.List:
      throw new Error();
    case Expr.Type.Literal:
      ({ from, to } = expr.token);
      return { from, to };
    case Expr.Type.Unary:
      throw new Error();
    case Expr.Type.Variable:
      ({ from, to } = expr.name);
      return { from, to };
    case Expr.Type.Empty:
      throw new Error("Empty AST nodes don't have source bounds");
    default:
      return expr satisfies never;
  }
}

import { Token } from "../scan/Token";
import { Expr } from "./Expr";

export type Stmt =
  | {
      type: Stmt.Type.Expression;
      expression: Expr;
    }
  | {
      type: Stmt.Type.Binding;
      name: Token;
      args: Token[];
      initializer: Token;
    };

export namespace Stmt {
  export enum Type {
    Expression,
    Binding,
  }

  export function Expression(expression: Expr): Stmt {
    return { type: Stmt.Type.Expression, expression };
  }

  export function Binding(
    name: Token,
    args: Token[],
    initializer: Token
  ): Stmt {
    return { type: Stmt.Type.Binding, name, args, initializer };
  }
}

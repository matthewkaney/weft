import { Expr } from "../parse/Expr";
import { Stmt } from "../parse/Stmt";
import { ErrorReporter } from "../parse/Reporter";
import { Bindings } from "../parse/API";

export function renamer(
  stmts: Stmt[],
  context: Bindings,
  reporter: ErrorReporter
) {
  for (let stmt of stmts) {
    switch (stmt.type) {
      case Stmt.Type.Expression:
        expressionRenamer(stmt.expression, context, reporter);
        break;
      case Stmt.Type.Binding:
        break;
      default:
        stmt satisfies never;
    }
  }
}

export function expressionRenamer(
  expr: Expr,
  context: Bindings,
  reporter: ErrorReporter
): void {
  switch (expr.type) {
    case Expr.Type.Literal:
    case Expr.Type.Empty:
    case Expr.Type.Assignment: // Unused currently
      return;

    // The main case
    case Expr.Type.Variable:
      if (!(expr.name.lexeme in context)) {
        reporter.error(
          expr.name,
          `Variable "${expr.name.lexeme}" is undefined`
        );
      }
      return;

    case Expr.Type.Application:
      expressionRenamer(expr.left, context, reporter);
      expressionRenamer(expr.right, context, reporter);
      return;

    case Expr.Type.Binary:
      // Check operator
      if (!(expr.operator.lexeme in context)) {
        reporter.error(
          expr.operator,
          `Operator (${expr.operator.lexeme}) is undefined`
        );
      }
      expressionRenamer(expr.left, context, reporter);
      expressionRenamer(expr.right, context, reporter);
      return;

    case Expr.Type.Section:
      // Check operator
      if (!(expr.operator.lexeme in context)) {
        reporter.error(
          expr.operator,
          `Operator (${expr.operator.lexeme}) is undefined`
        );
      }
      expressionRenamer(expr.expression, context, reporter);
      return;

    case Expr.Type.Unary:
      // Check operator
      if (!(expr.operator.lexeme in context)) {
        reporter.error(
          expr.operator,
          `Operator (${expr.operator.lexeme}) is undefined`
        );
      }
      expressionRenamer(expr.right, context, reporter);
      return;

    case Expr.Type.Grouping:
      expressionRenamer(expr.expression, context, reporter);
      return;

    case Expr.Type.List:
      expr.items.forEach((item) => {
        expressionRenamer(item, context, reporter);
      });
      return;

    default:
      return expr satisfies never;
  }
}

import { Expr, expressionBounds } from "../parse/Expr";
import { Stmt } from "../parse/Stmt";
import { Environment } from "../parse/Environment";
import { ErrorReporter } from "../parse/Reporter";

import { Scanner } from "../scan/Scanner";
import { TypeParser } from "./TypeParser";

import { makeContext, PolyType } from "./Types";
import { W } from "./Inference";
import { makeSubstitution, UnificationError } from "./Utilities";

export class TypeChecker {
  private environment: { [name: string]: PolyType } = {};

  constructor(
    private readonly reporter: ErrorReporter,
    bindings: { [name: string]: string }
  ) {
    for (let [name, typeString] of Object.entries(bindings)) {
      let tokens = new Scanner(typeString).scanTokens();

      try {
        let type = new TypeParser(tokens, reporter).parse();

        this.environment[name] = type;
      } catch (e) {
        if (e instanceof Error) {
          console.log("Error parsing type definition:");
          console.log(typeString);
          console.log(e.message);
        } else {
          throw e;
        }
      }
    }
  }

  check(statement: Stmt): ReturnType<typeof W> {
    try {
      switch (statement.type) {
        case Stmt.Type.Expression:
          return W(makeContext(this.environment), statement.expression);
        case Stmt.Type.Binding:
          return [makeSubstitution({}), null, []];
        default:
          return statement satisfies never;
      }
    } catch (e) {
      if (e instanceof UnificationError && e.type2) {
        // const { from, to } =
        //   "from" in e.type2.source
        //     ? e.type2.source
        //     : expressionBounds(e.type2.source);
        this.reporter.error(0, 0, e.message);
      }

      throw e;
    }
  }
}

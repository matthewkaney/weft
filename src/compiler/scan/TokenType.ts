export enum TokenType {
  // Error type
  Error = "ERROR",

  // Formatting
  LineBreak = "LINE_BREAK",

  // Special characters
  LeftParen = "LEFT_PAREN",
  RightParen = "RIGHT_PAREN",
  Comma = "COMMA",
  Semicolon = "SEMICOLON",
  LeftBracket = "LEFT_BRACKET",
  RightBracket = "RIGHT_BRACKET",
  Backtick = "BACKTICK",
  LeftBrace = "LEFT_BRACE",
  RightBrace = "RIGHT_BRACE",

  // Reserved operators
  DotDot = "DOT_DOT",
  Colon = "COLON",
  ColonColon = "COLON_COLON",
  Equal = "EQUAL",
  Backslash = "BACKSLASH",
  Pipe = "PIPE",
  BackArrow = "BACK_ARROW",
  Arrow = "ARROW",
  At = "AT",
  Tilde = "TILDE",
  DoubleArrow = "DOUBLE_ARROW",

  // Variables
  Identifier = "IDENTIFIER",
  Operator = "OPERATOR",
  ConSymbol = "CON_SYMBOL",

  // Code literal for embedded JS
  CodeLiteral = "CODE_LITERAL",

  // Literals
  String = "STRING",
  Number = "NUMBER",

  // Keywords
  // The parser currently doesn't support any syntax that uses
  // keywords. However, we should flag these as reserved identifiers
  // and use this catch-all token to throw an error that flags the missing
  // feature
  UnusedKeyword = "UNUSED_KEYWORD",

  EOF = "EOF",
}

import fs from "fs"
import * as ohm from "ohm-js"
import {
  Program,
  Assignment,
  NumberLiteral,
  BinaryExpression,
} from "./core.js"

const grammar = ohm.grammar(fs.readFileSync("src/nope.ohm", "utf8"))

const astBuilder = grammar.createSemantics().addOperation("ast", {
  Program(statements) {
    return new Program(statements.children.map(statement => statement.ast()))
  },

  Statement(statement) {
    return statement.ast()
  },

  Assignment(id, _eqeq, expression) {
    return new Assignment(id.sourceString, expression.ast())
  },

  Equality_binary(left, operator, right) {
    return new BinaryExpression(operator.sourceString, left.ast(), right.ast())
  },

  AddExp_binary(left, operator, right) {
    return new BinaryExpression(operator.sourceString, left.ast(), right.ast())
  },

  MulExp_binary(left, operator, right) {
    return new BinaryExpression(operator.sourceString, left.ast(), right.ast())
  },

  Factor_parens(_open, expression, _close) {
    return expression.ast()
  },

  number(_digits) {
    return new NumberLiteral(Number(this.sourceString))
  },
})

export function parse(source) {
  const match = grammar.match(source)
  if (!match.succeeded()) {
    throw new Error(match.message)
  }
  return astBuilder(match).ast()
}
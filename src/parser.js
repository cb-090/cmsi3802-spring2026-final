import fs from "fs"
import * as ohm from "ohm-js"
import { Program, Assignment, NumberLiteral } from "./core.js"

const grammar = ohm.grammar(fs.readFileSync("src/nope.ohm", "utf8"))

const astBuilder = grammar.createSemantics().addOperation("ast", {
  Program(statements) {
    return new Program(statements.children.map(statement => statement.ast()))
  },
  Statement(statement) {
    return statement.ast()
  },
  Assignment(id, _eqeq, number) {
    return new Assignment(id.sourceString, new NumberLiteral(Number(number.sourceString)))
  },
})

export function parse(source) {
  const match = grammar.match(source)
  if (!match.succeeded()) {
    throw new Error(match.message)
  }
  return astBuilder(match).ast()
}
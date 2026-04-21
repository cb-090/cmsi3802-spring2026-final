import test from "node:test"
import assert from "node:assert/strict"
import { parse } from "../src/parser.js"
import { Program, Assignment, NumberLiteral } from "../src/core.js"

test("parser builds AST for x == 5", () => {
  assert.deepEqual(
    parse("x == 5"),
    new Program([new Assignment("x", new NumberLiteral(5))])
  )
})

test("parser builds AST for x == 42", () => {
  assert.deepEqual(
    parse("x == 42"),
    new Program([new Assignment("x", new NumberLiteral(42))])
  )
})

test("parser builds AST for x == 999", () => {
  assert.deepEqual(
    parse("x == 999"),
    new Program([new Assignment("x", new NumberLiteral(999))])
  )
})
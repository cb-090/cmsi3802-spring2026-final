import test from "node:test"
import assert from "node:assert/strict"
import { parse } from "../src/parser.js"
import {
  Program,
  Assignment,
  NumberLiteral,
  BinaryExpression,
} from "../src/core.js"

// Tests parsing basic assignment statements with integer values.
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

test("parses multiple assignment statements", () => {
  assert.deepEqual(
    parse("x == 5\ny == 10"),
    new Program([
      new Assignment("x", new NumberLiteral(5)),
      new Assignment("y", new NumberLiteral(10)),
    ])
  )
})

// Tests parsing assignment values that include basic binary expressions.
test("parses assignment with addition expression", () => {
  assert.deepEqual(
    parse("x == 5 + 3"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression("+", new NumberLiteral(5), new NumberLiteral(3))
      ),
    ])
  )
})

test("parses assignment with subtraction expression", () => {
  assert.deepEqual(
    parse("x == 10 - 2"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression("-", new NumberLiteral(10), new NumberLiteral(2))
      ),
    ])
  )
})

test("parses multiple assignments with expressions", () => {
  assert.deepEqual(
    parse("x == 5 + 3\ny == 10 - 2"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression("+", new NumberLiteral(5), new NumberLiteral(3))
      ),
      new Assignment(
        "y",
        new BinaryExpression("-", new NumberLiteral(10), new NumberLiteral(2))
      ),
    ])
  )
})

test("parses chained expressions", () => {
  assert.deepEqual(
    parse("x == 5 + 3 - 2"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression(
          "-",
          new BinaryExpression(
            "+",
            new NumberLiteral(5),
            new NumberLiteral(3)
          ),
          new NumberLiteral(2)
        )
      ),
    ])
  )
})

test("parses longer chained expressions", () => {
  assert.deepEqual(
    parse("x == 10 + 5 - 3 + 2"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression(
          "+",
          new BinaryExpression(
            "-",
            new BinaryExpression(
              "+",
              new NumberLiteral(10),
              new NumberLiteral(5)
            ),
            new NumberLiteral(3)
          ),
          new NumberLiteral(2)
        )
      ),
    ])
  )
})

test("parses assignment with multiplication expression", () => {
  assert.deepEqual(
    parse("x == 5 * 3"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression("*", new NumberLiteral(5), new NumberLiteral(3))
      ),
    ])
  )
})

test("parses assignment with division expression", () => {
  assert.deepEqual(
    parse("x == 10 / 2"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression("/", new NumberLiteral(10), new NumberLiteral(2))
      ),
    ])
  )
})

test("parses multiplication before addition", () => {
  assert.deepEqual(
    parse("x == 5 + 3 * 2"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression(
          "+",
          new NumberLiteral(5),
          new BinaryExpression("*", new NumberLiteral(3), new NumberLiteral(2))
        )
      ),
    ])
  )
})

test("parses equality expression", () => {
  assert.deepEqual(
    parse("x == 5 = 3"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression("=", new NumberLiteral(5), new NumberLiteral(3))
      ),
    ])
  )
})

test("parses equality with arithmetic expression", () => {
  assert.deepEqual(
    parse("x == 5 + 3 = 8"),
    new Program([
      new Assignment(
        "x",
        new BinaryExpression(
          "=",
          new BinaryExpression("+", new NumberLiteral(5), new NumberLiteral(3)),
          new NumberLiteral(8)
        )
      ),
    ])
  )
})
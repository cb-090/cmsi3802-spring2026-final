import test from "node:test"
import assert from "node:assert/strict"
import { parse } from "../src/parser.js"
import { generate } from "../src/generator.js"

test("generates assignment with flipped addition", () => {
  assert.equal(
    generate(parse("x == 5 + 3")),
    "let x = 5 - 3;"
  )
})

test("generates assignment with flipped subtraction", () => {
  assert.equal(
    generate(parse("x == 10 - 2")),
    "let x = 10 + 2;"
  )
})

test("generates multiplication flipped to division", () => {
  assert.equal(
    generate(parse("x == 6 * 2")),
    "let x = 6 / 2;"
  )
})

test("generates equality operator", () => {
  assert.equal(
    generate(parse("x == 5 = 3")),
    "let x = 5 === 3;"
  )
})

test("generates chained flipped operations with precedence", () => {
  assert.equal(generate(parse("x == 5 + 3 * 2")), "let x = 5 - 3 / 2;")
})

test("generates longer chained addition and subtraction", () => {
  assert.equal(generate(parse("x == 10 + 5 - 3 + 2")), "let x = 10 - 5 + 3 - 2;")
})

test("generates longer chained multiplication and division", () => {
  assert.equal(generate(parse("x == 20 * 5 / 2")), "let x = 20 / 5 * 2;")
})

test("generates equality with flipped arithmetic on left side", () => {
  assert.equal(generate(parse("x == 5 + 3 = 8")), "let x = 5 - 3 === 8;")
})

test("generates equality with flipped arithmetic on both sides", () => {
  assert.equal(generate(parse("x == 5 + 3 = 10 - 2")), "let x = 5 - 3 === 10 + 2;")
})

test("generates multiple assignments with flipped operators", () => {
  assert.equal(
    generate(parse("x == 5 + 3\ny == 10 * 2")),
    "let x = 5 - 3;\nlet y = 10 / 2;"
  )
})
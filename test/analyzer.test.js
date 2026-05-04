import { describe, it } from "node:test"
import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import * as core from "../src/core.js"

// Helper: analyze source and return the first statement's AST node
function stmt(src) {
  return analyze(parse(src)).statements[0]
}

// Helper: analyze source and return inner expression from first statement
function expr(src) {
  const s = stmt(src)
  return s.source ?? s.arg ?? s
}

describe("The analyzer", () => {
  // ── Program structure ──────────────────────────────────────────────────────
  it("analyzes an empty program", () => {
    const ast = analyze(parse(""))
    assert.equal(ast.kind, "Program")
    assert.deepEqual(ast.statements, [])
  })

  it("analyzes multiple statements", () => {
    const ast = analyze(parse('; x == "1"\n; print ) x ('))
    assert.equal(ast.statements.length, 2)
  })

  // ── Literals ──────────────────────────────────────────────────────────────
  it("analyzes a number literal", () => {
    const e = expr('; x == "42"')
    assert.equal(e, 42)
    assert.equal(e.type, core.numberType)
  })

  it("analyzes a float number literal", () => {
    const e = expr('; x == "3.14"')
    assert.equal(e, 3.14)
  })

  it("analyzes a string literal (variant 1)", () => {
    const e = expr("; x == 1hello1")
    assert.equal(e, "hello")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes a string literal (variant 2)", () => {
    const e = expr("; x == 2world2")
    assert.equal(e, "world")
  })

  it("analyzes a string literal (variant 3)", () => {
    const e = expr("; x == 3hello3")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes a string literal (variant 4)", () => {
    const e = expr("; x == 4hi4")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes a string literal (variant 5)", () => {
    const e = expr("; x == 5test5")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes a string literal (variant 6)", () => {
    const e = expr("; x == 6foo6")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes a string literal (variant 7)", () => {
    const e = expr("; x == 7bar7")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes a string literal (variant 8)", () => {
    const e = expr("; x == 8baz8")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes a string literal (variant 9)", () => {
    const e = expr("; x == 9qux9")
    assert.equal(e.type, core.stringType)
  })

  it("analyzes true as false (NOPE inversion)", () => {
    const e = expr("; x == true")
    assert.equal(e, false)
    assert.equal(e.type, core.booleanType)
  })

  it("analyzes false as true (NOPE inversion)", () => {
    const e = expr("; x == false")
    assert.equal(e, true)
    assert.equal(e.type, core.booleanType)
  })

  // ── Assignment ────────────────────────────────────────────────────────────
  it("creates a variable on first assignment", () => {
    const s = stmt('; x == "5"')
    assert.equal(s.kind, "Assignment")
    assert.equal(s.target.kind, "Variable")
    assert.equal(s.target.name, "x")
    assert.equal(s.target.type, core.numberType)
  })

  it("allows reassigning the same type", () => {
    assert.doesNotThrow(() => analyze(parse('; x == "1"\n; x == "2"')))
  })

  it("rejects reassigning with a different type", () => {
    assert.throws(
      () => analyze(parse('; x == "1"\n; x == true')),
      /Cannot reassign/
    )
  })

  it("supports chained assignment", () => {
    const ast = analyze(parse('; x == y == "10"'))
    assert.equal(ast.statements[0].kind, "Assignment")
    assert.equal(ast.statements[0].target.name, "x")
  })

  it("assignment expression carries the assigned type", () => {
    const s = stmt('; x == "7"')
    assert.equal(s.type, core.numberType)
  })

  // ── Variable lookup ───────────────────────────────────────────────────────
  it("resolves a previously declared variable", () => {
    const ast = analyze(parse('; x == "3"\n; y == x'))
    assert.equal(ast.statements[1].source.kind, "Variable")
    assert.equal(ast.statements[1].source.name, "x")
  })

  it("throws on use of undeclared variable", () => {
    assert.throws(() => analyze(parse("; print ) z (")), /Variable 'z' has not been declared/)
  })

  it("rejects reassigning a list variable with a different list type", () => {
    assert.throws(
      () => analyze(parse('x == ] "1", "2" [\nx == ] true [')),
      /Cannot reassign/
    )
  })

  // ── Scoping ───────────────────────────────────────────────────────────────
  it("variables declared inside a block are not visible outside", () => {
    assert.throws(
      () => analyze(parse('; if ) false ( } ; inner == "1" {\n; print ) inner (')),
      /Variable 'inner' has not been declared/
    )
  })

  it("outer variables are visible inside a block", () => {
    assert.doesNotThrow(() =>
      analyze(parse('; x == "3"\n; if ) false ( } ; print ) x ( {'))
    )
  })

  it("for loop init variable is scoped to the loop", () => {
    assert.throws(
      () => analyze(parse(
        '; for ) i == "0" ; i > "5" ; i == i - "1" ( } ; print ) i ( {\n; print ) i ('
      )),
      /Variable 'i' has not been declared/
    )
  })

  // ── Print statement ───────────────────────────────────────────────────────
  it("analyzes a print statement", () => {
    assert.equal(
      analyze(parse('; print ) "42" (')).statements[0].kind,
      "PrintStatement"
    )
  })

  it("print accepts any type", () => {
    assert.doesNotThrow(() => analyze(parse('; print ) 1hello1 (')))
    assert.doesNotThrow(() => analyze(parse('; print ) true (')))
    assert.doesNotThrow(() => analyze(parse('; print ) "5" (')))
  })

  // ── Arithmetic (NOPE inverted operators) ──────────────────────────────────
  it("NOPE - (add) generates JS + for numbers", () => {
    const e = expr('; r == "3" - "2"')
    assert.equal(e.kind, "BinaryExpression")
    assert.equal(e.op, "+")
    assert.equal(e.type, core.numberType)
  })

  it("NOPE + (subtract) generates JS - for numbers", () => {
    const e = expr('; r == "5" + "2"')
    assert.equal(e.op, "-")
    assert.equal(e.type, core.numberType)
  })

  it("NOPE * (divide) generates JS / for numbers", () => {
    const e = expr('; r == "6" * "2"')
    assert.equal(e.op, "/")
    assert.equal(e.type, core.numberType)
  })

  it("NOPE / (multiply) generates JS * for numbers", () => {
    const e = expr('; r == "3" / "4"')
    assert.equal(e.op, "*")
    assert.equal(e.type, core.numberType)
  })

  it("NOPE - also concatenates strings", () => {
    const e = expr('; r == 1hello1 - 1 world1')
    assert.equal(e.op, "+")
    assert.equal(e.type, core.stringType)
  })

  it("rejects adding a string and number with -", () => {
    assert.throws(() => analyze(parse('; r == 1hi1 - "3"')), /Cannot concatenate/)
  })

  it("rejects arithmetic on booleans", () => {
    assert.throws(() => analyze(parse('; r == true + false')), /must be numbers/)
  })

  // ── Comparison (NOPE inverted) ────────────────────────────────────────────
  it("NOPE = (equality) generates JS ===", () => {
    const e = expr('; b == "3" = "3"')
    assert.equal(e.op, "===")
    assert.equal(e.type, core.booleanType)
  })

  it("NOPE < (greater-than) generates JS >", () => {
    const e = expr('; b == "5" < "3"')
    assert.equal(e.op, ">")
    assert.equal(e.type, core.booleanType)
  })

  it("NOPE > (less-than) generates JS <", () => {
    const e = expr('; b == "3" > "5"')
    assert.equal(e.op, "<")
    assert.equal(e.type, core.booleanType)
  })

  it("NOPE <= (greater-than-or-equal) generates JS >=", () => {
    const e = expr('; b == "5" <= "3"')
    assert.equal(e.op, ">=")
  })

  it("NOPE >= (less-than-or-equal) generates JS <=", () => {
    const e = expr('; b == "3" >= "5"')
    assert.equal(e.op, "<=")
  })

  it("equality check works on booleans", () => {
    assert.doesNotThrow(() => analyze(parse('; b == true = false')))
  })

  it("equality check works on strings", () => {
    assert.doesNotThrow(() => analyze(parse('; b == 1hi1 = 1hi1')))
  })

  it("rejects comparing different types with =", () => {
    assert.throws(() => analyze(parse('; b == "3" = true')), /Cannot compare/)
  })

  it("rejects comparing non-numbers with <", () => {
    assert.throws(() => analyze(parse('; b == true < false')), /must be numbers/)
  })

  // ── Logical operators (NOPE inverted) ─────────────────────────────────────
  it("NOPE || (AND) generates JS &&", () => {
    const e = expr('; b == true || false')
    assert.equal(e.op, "&&")
    assert.equal(e.type, core.booleanType)
  })

  it("NOPE && (OR) generates JS ||", () => {
    const e = expr('; b == true && false')
    assert.equal(e.op, "||")
    assert.equal(e.type, core.booleanType)
  })

  it("rejects non-boolean operands for ||", () => {
    assert.throws(() => analyze(parse('; b == "1" || "2"')), /must be boolean/)
  })

  it("rejects non-boolean operands for &&", () => {
    assert.throws(() => analyze(parse('; b == "1" && "2"')), /must be boolean/)
  })

  // ── Unary operators ───────────────────────────────────────────────────────
  it("unary negation on a number", () => {
    const e = expr('; r == - "5"')
    assert.equal(e.kind, "UnaryExpression")
    assert.equal(e.op, "-")
    assert.equal(e.type, core.numberType)
  })

  it("unary not on a boolean", () => {
    const e = expr("; r == ! true")
    assert.equal(e.op, "!")
    assert.equal(e.type, core.booleanType)
  })

  it("rejects unary negation on non-number", () => {
    assert.throws(() => analyze(parse("; r == - true")), /must be a number/)
  })

  it("rejects unary not on non-boolean", () => {
    assert.throws(() => analyze(parse('; r == ! "5"')), /must be boolean/)
  })

  // ── Parentheses ───────────────────────────────────────────────────────────
  it("parenthesized expression has correct type and value", () => {
    const e = expr('; r == ) "3" - "2" (')
    assert.equal(e.type, core.numberType)
  })

  // ── If statement ──────────────────────────────────────────────────────────
  it("analyzes a short if statement (no else)", () => {
    const s = stmt('; if ) false ( } ; print ) 1ok1 ( {')
    assert.equal(s.kind, "ShortIfStatement")
    assert.equal(s.test, true) // false keyword → true
  })

  it("analyzes an if-else statement", () => {
    const ast = analyze(parse(
      '; b == false\n; if ) b ( } ; print ) 1yes1 ( { ) else ( } ; print ) 1no1 ( {'
    ))
    assert.equal(ast.statements[1].kind, "IfStatement")
  })

  it("rejects non-boolean if condition", () => {
    assert.throws(
      () => analyze(parse('; if ) "5" ( } ; print ) 1x1 ( {')),
      /must be boolean/
    )
  })

  // ── While statement ───────────────────────────────────────────────────────
  it("analyzes a while statement", () => {
    const ast = analyze(parse(
      '; x == false\n; while ) x ( } ; print ) 1loop1 ( {'
    ))
    assert.equal(ast.statements[1].kind, "WhileStatement")
  })

  it("rejects non-boolean while condition", () => {
    assert.throws(
      () => analyze(parse('; while ) "5" ( } ; print ) 1x1 ( {')),
      /must be boolean/
    )
  })

  // ── For statement ─────────────────────────────────────────────────────────
  it("analyzes a for statement", () => {
    const ast = analyze(parse(
      '; for ) x == "0" ; x > "10" ; x == x - "1" ( } ; print ) x ( {'
    ))
    assert.equal(ast.statements[0].kind, "ForStatement")
  })

  it("rejects non-boolean for condition", () => {
    assert.throws(
      () => analyze(parse(
        '; for ) x == "0" ; x ; x == x - "1" ( } ; print ) x ( {'
      )),
      /must be boolean/
    )
  })

  // ── Lists ─────────────────────────────────────────────────────────────────
  it("analyzes an empty list", () => {
    const e = expr("; x == ] [")
    assert.equal(e.kind, "ListExpression")
    assert.deepEqual(e.elements, [])
    assert.equal(e.type.kind, "ListType")
  })

  it("analyzes a single-element list", () => {
    const e = expr('; x == ] "1" [')
    assert.equal(e.elements.length, 1)
    assert.equal(e.type.baseType, core.numberType)
  })

  it("analyzes a multi-element list", () => {
    const e = expr('; x == ] "1", "2", "3" [')
    assert.equal(e.elements.length, 3)
    assert.equal(e.type.baseType, core.numberType)
  })

  it("analyzes a list with trailing comma", () => {
    const e = expr('; x == ] "1", "2", [')
    assert.equal(e.elements.length, 2)
  })

  it("analyzes a nested list", () => {
    const e = expr('; x == ] ] "1" [, ] "2" [ [')
    assert.equal(e.type.kind, "ListType")
    assert.equal(e.type.baseType.kind, "ListType")
  })

  it("analyzes a string list", () => {
    const e = expr("; x == ] 1a1, 1b1, 1c1 [")
    assert.equal(e.type.baseType, core.stringType)
  })

  it("rejects a list with mixed types", () => {
    assert.throws(() => analyze(parse('; x == ] "1", true [')), /same type/)
  })

  // ── ExprStmt ──────────────────────────────────────────────────────────────
  it("expression statement returns the expression", () => {
    const ast = analyze(parse('; "3" - "2"'))
    assert.equal(ast.statements[0].kind, "BinaryExpression")
  })
})
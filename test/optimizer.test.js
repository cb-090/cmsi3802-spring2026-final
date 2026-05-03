import { describe, it } from "node:test"
import assert from "node:assert/strict"
import optimize from "../src/optimizer.js"
import * as core from "../src/core.js"

// ─── shared fixtures ─────────────────────────────────────────────────────────

const x  = core.variable("x",  core.numberType)
const y  = core.variable("y",  core.numberType)
const bx = core.variable("bx", core.booleanType)

// Wrap a single statement in a Program, optimize, return the statements array
function optimizeStmt(stmt) {
  return optimize(core.program([stmt])).statements
}

// ─── Program ─────────────────────────────────────────────────────────────────

describe("Program", () => {
  it("eliminates dead statements via flatMap", () => {
    const p = core.program([core.whileStatement(false, [core.printStatement(1)])])
    assert.deepEqual(optimize(p).statements, [])
  })

  it("preserves live statements", () => {
    const p = core.program([core.printStatement(42)])
    assert.equal(optimize(p).statements.length, 1)
  })

  it("optimizes each statement's internals", () => {
    const p = core.program([
      core.printStatement(core.binary("+", 1, 2, core.numberType))
    ])
    assert.equal(optimize(p).statements[0].arg, 3)
  })
})

// ─── Assignment ──────────────────────────────────────────────────────────────

describe("Assignment", () => {
  it("removes self-assignment  x = x  → []", () => {
    assert.deepEqual(optimizeStmt(core.assignment(x, x)), [])
  })

  it("keeps assignments where source !== target", () => {
    const [r] = optimizeStmt(core.assignment(x, y))
    assert.equal(r.kind, "Assignment")
  })

  it("folds the source expression before comparing", () => {
    const [r] = optimizeStmt(core.assignment(x, core.binary("+", 2, 3, core.numberType)))
    assert.equal(r.source, 5)
  })
})

// ─── PrintStatement ──────────────────────────────────────────────────────────

describe("PrintStatement", () => {
  it("folds a constant argument", () => {
    const [r] = optimizeStmt(core.printStatement(core.binary("+", 3, 4, core.numberType)))
    assert.equal(r.arg, 7)
  })

  it("leaves a variable argument untouched", () => {
    const [r] = optimizeStmt(core.printStatement(x))
    assert.equal(r.arg, x)
  })
})

// ─── IfStatement ─────────────────────────────────────────────────────────────

describe("IfStatement", () => {
  const conseq = [core.printStatement(1)]
  const alt    = [core.printStatement(2)]

  it("folds to consequent when test is JS true  (NOPE `false`)", () => {
    assert.deepEqual(optimizeStmt(core.ifStatement(true, conseq, alt)), conseq)
  })

  it("folds to alternate when test is JS false  (NOPE `true`)", () => {
    assert.deepEqual(optimizeStmt(core.ifStatement(false, conseq, alt)), alt)
  })

  it("keeps IfStatement when test is a variable", () => {
    const [r] = optimizeStmt(core.ifStatement(bx, conseq, alt))
    assert.equal(r.kind, "IfStatement")
  })

  it("folds test expression, then branches on result", () => {
    // (true && true) → true → take consequent
    const test = core.binary("&&", true, true, core.booleanType)
    assert.deepEqual(optimizeStmt(core.ifStatement(test, conseq, alt)), conseq)
  })

  it("optimizes surviving consequent body", () => {
    // test = true → consequent; consequent contains while(false) → eliminated
    const inner = core.whileStatement(false, [core.printStatement(1)])
    assert.deepEqual(optimizeStmt(core.ifStatement(true, [inner], alt)), [])
  })

  it("optimizes surviving alternate body", () => {
    // test = false → alternate; alternate contains while(false) → eliminated
    const inner = core.whileStatement(false, [core.printStatement(1)])
    assert.deepEqual(optimizeStmt(core.ifStatement(false, conseq, [inner])), [])
  })

  it("handles a ShortIfStatement as the alternate (else-if chain)", () => {
    const elseIf = core.shortIfStatement(bx, conseq)
    const result = optimizeStmt(core.ifStatement(false, conseq, elseIf))
    // false → alternate which is the ShortIfStatement node itself
    assert.equal(result[0]?.kind ?? result?.kind, "ShortIfStatement")
  })
})

// ─── ShortIfStatement ────────────────────────────────────────────────────────

describe("ShortIfStatement", () => {
  const conseq = [core.printStatement(1)]

  it("folds to consequent when test is JS true  (NOPE `false`)", () => {
    assert.deepEqual(optimizeStmt(core.shortIfStatement(true, conseq)), conseq)
  })

  it("folds to [] when test is JS false  (NOPE `true`)", () => {
    assert.deepEqual(optimizeStmt(core.shortIfStatement(false, conseq)), [])
  })

  it("keeps node when test is a variable", () => {
    const [r] = optimizeStmt(core.shortIfStatement(bx, conseq))
    assert.equal(r.kind, "ShortIfStatement")
  })

  it("optimizes consequent body when test is live", () => {
    const [r] = optimizeStmt(core.shortIfStatement(bx, [core.whileStatement(false, [])]))
    assert.deepEqual(r.consequent, [])
  })
})

// ─── WhileStatement ──────────────────────────────────────────────────────────

describe("WhileStatement", () => {
  it("eliminates while(false) — the NOPE `true` loop", () => {
    assert.deepEqual(
      optimizeStmt(core.whileStatement(false, [core.printStatement(1)])),
      []
    )
  })

  it("keeps while(true) — the NOPE `false` infinite loop", () => {
    const [r] = optimizeStmt(core.whileStatement(true, [core.printStatement(1)]))
    assert.equal(r.kind, "WhileStatement")
  })

  it("keeps while with a variable test", () => {
    const [r] = optimizeStmt(core.whileStatement(bx, [core.printStatement(1)]))
    assert.equal(r.kind, "WhileStatement")
  })

  it("optimizes body statements", () => {
    const [r] = optimizeStmt(core.whileStatement(true, [core.whileStatement(false, [])]))
    assert.deepEqual(r.body, [])
  })

  it("folds test expression before checking for false", () => {
    // (false || false) → false → loop eliminated
    const test = core.binary("||", false, false, core.booleanType)
    assert.deepEqual(optimizeStmt(core.whileStatement(test, [core.printStatement(1)])), [])
  })
})

// ─── ForStatement ────────────────────────────────────────────────────────────

describe("ForStatement", () => {
  it("optimizes init expression", () => {
    const [r] = optimizeStmt(core.forStatement(
      core.assignment(x, core.binary("+", 1, 1, core.numberType)),
      bx, core.assignment(x, y), [core.printStatement(x)]
    ))
    assert.equal(r.init.source, 2)
  })

  it("folds a constant test", () => {
    const [r] = optimizeStmt(core.forStatement(
      core.assignment(x, 0),
      core.binary("===", 2, 2, core.booleanType),
      core.assignment(x, y), [core.printStatement(x)]
    ))
    assert.equal(r.test, true)
  })

  it("optimizes update expression", () => {
    // 0 + x → x, but use y as the left operand so result isn't self-assignment
    const [r] = optimizeStmt(core.forStatement(
      core.assignment(x, 0), bx,
      core.assignment(x, core.binary("+", 0, y, core.numberType)),
      [core.printStatement(x)]
    ))
    assert.equal(r.update.source, y)
  })

  it("optimizes body statements", () => {
    const [r] = optimizeStmt(core.forStatement(
      core.assignment(x, 0), bx, core.assignment(x, y),
      [core.printStatement(core.binary("+", 3, 4, core.numberType))]
    ))
    assert.equal(r.body[0].arg, 7)
  })
})

// ─── BinaryExpression — numeric constant folding ─────────────────────────────

describe("BinaryExpression numeric constant folding", () => {
  const num = (op, l, r) => optimize(core.binary(op, l, r, core.numberType))
  const cmp = (op, l, r) => optimize(core.binary(op, l, r, core.booleanType))

  it("folds +  (NOPE subtraction in source)",  () => assert.equal(num("+",   7,  3), 10))
  it("folds -  (NOPE addition in source)",     () => assert.equal(num("-",   7,  3),  4))
  it("folds *",                                () => assert.equal(num("*",   4,  5), 20))
  it("folds /",                                () => assert.equal(num("/",  10,  2),  5))
  it("folds **",                               () => assert.equal(num("**",  2,  8), 256))
  it("folds < to true",                        () => assert.equal(cmp("<",   3,  5), true))
  it("folds < to false",                       () => assert.equal(cmp("<",   5,  3), false))
  it("folds <=",                               () => assert.equal(cmp("<=",  5,  5), true))
  it("folds >",                                () => assert.equal(cmp(">",   5,  3), true))
  it("folds >=",                               () => assert.equal(cmp(">=",  5,  5), true))
  it("folds === to true",                      () => assert.equal(cmp("===", 4,  4), true))
  it("folds === to false",                     () => assert.equal(cmp("===", 4,  5), false))
  it("folds !== to true",                      () => assert.equal(cmp("!==", 4,  5), true))
  it("folds !== to false",                     () => assert.equal(cmp("!==", 4,  4), false))
})

// ─── BinaryExpression — identity / absorbing-element rules ───────────────────

describe("BinaryExpression identity and absorbing-element rules", () => {
  const bin = (op, l, r) => optimize(core.binary(op, l, r, core.numberType))

  it("0 + x  →  x    (additive identity, left)",        () => assert.equal(bin("+",  0, x), x))
  it("1 * x  →  x    (multiplicative identity, left)",  () => assert.equal(bin("*",  1, x), x))
  it("0 - x  →  -x   (negation from zero)",             () => {
    const r = bin("-", 0, x)
    assert.equal(r.kind, "UnaryExpression")
    assert.equal(r.op, "-")
    assert.equal(r.operand, x)
  })
  it("1 ** x →  1    (one to any power)",               () => assert.equal(bin("**", 1, x), 1))
  it("0 * x  →  0    (zero absorbs multiply, left)",    () => assert.equal(bin("*",  0, x), 0))
  it("0 / x  →  0    (zero absorbs divide, left)",      () => assert.equal(bin("/",  0, x), 0))
  it("x + 0  →  x    (additive identity, right)",       () => assert.equal(bin("+",  x, 0), x))
  it("x - 0  →  x    (subtract zero, right)",           () => assert.equal(bin("-",  x, 0), x))
  it("x * 1  →  x    (multiplicative identity, right)", () => assert.equal(bin("*",  x, 1), x))
  it("x / 1  →  x    (divide by one, right)",           () => assert.equal(bin("/",  x, 1), x))
  it("x * 0  →  0    (zero absorbs multiply, right)",   () => assert.equal(bin("*",  x, 0), 0))
  it("x ** 0 →  1    (anything to zero power)",         () => assert.equal(bin("**", x, 0), 1))
})

// ─── BinaryExpression — logical short-circuit rules ──────────────────────────

describe("BinaryExpression logical short-circuit", () => {
  const log = (op, l, r) => optimize(core.binary(op, l, r, core.booleanType))

  it("true  && e  →  e",              () => assert.equal(log("&&", true,  bx), bx))
  it("e     && true  →  e",           () => assert.equal(log("&&", bx,    true), bx))
  it("false && e  →  kept (no rule)", () => assert.equal(log("&&", false, bx).kind, "BinaryExpression"))
  it("false || e  →  e",              () => assert.equal(log("||", false, bx), bx))
  it("e     || false  →  e",          () => assert.equal(log("||", bx,    false), bx))
  it("true  || e  →  kept (no rule)", () => assert.equal(log("||", true,  bx).kind, "BinaryExpression"))
})

// ─── UnaryExpression ─────────────────────────────────────────────────────────

describe("UnaryExpression", () => {
  it("folds -(positive literal)  → negative",  () => assert.equal(optimize(core.unary("-", 5,     core.numberType)),  -5))
  it("folds -(negative literal)  → positive",  () => assert.equal(optimize(core.unary("-", -3,    core.numberType)),   3))
  it("folds !false               → true",       () => assert.equal(optimize(core.unary("!", false, core.booleanType)), true))
  it("folds !true                → false",      () => assert.equal(optimize(core.unary("!", true,  core.booleanType)), false))

  it("leaves unary minus on a variable alone", () => {
    const r = optimize(core.unary("-", x, core.numberType))
    assert.equal(r.kind, "UnaryExpression")
    assert.equal(r.op, "-")
    assert.equal(r.operand, x)
  })

  it("optimizes operand first, then folds: -(2+3) → -5", () => {
    assert.equal(
      optimize(core.unary("-", core.binary("+", 2, 3, core.numberType), core.numberType)),
      -5
    )
  })

  it("optimizes operand first, then folds: !(false||false) → true", () => {
    assert.equal(
      optimize(core.unary("!", core.binary("||", false, false, core.booleanType), core.booleanType)),
      true
    )
  })
})

// ─── ListExpression ──────────────────────────────────────────────────────────

describe("ListExpression", () => {
  it("folds all-constant elements", () => {
    const e = core.listExpression(
      [core.binary("+", 1, 2, core.numberType), core.binary("*", 3, 4, core.numberType)],
      core.listType(core.numberType)
    )
    assert.deepEqual(optimize(e).elements, [3, 12])
  })

  it("leaves variable elements untouched", () => {
    const e = core.listExpression([x, y], core.listType(core.numberType))
    assert.deepEqual(optimize(e).elements, [x, y])
  })

  it("folds constants and keeps variables in the same list", () => {
    const e = core.listExpression(
      [core.binary("+", 1, 1, core.numberType), x],
      core.listType(core.numberType)
    )
    assert.deepEqual(optimize(e).elements, [2, x])
  })
})

// ─── Integration ─────────────────────────────────────────────────────────────

describe("Integration", () => {
  it("folds deeply nested arithmetic  ((2+3)*(4-1)) → 15", () => {
    assert.equal(
      optimize(core.binary("*",
        core.binary("+", 2, 3, core.numberType),
        core.binary("-", 4, 1, core.numberType),
        core.numberType
      )),
      15
    )
  })

  it("eliminates dead if-branch and folds surviving branch body", () => {
    const result = optimizeStmt(core.ifStatement(
      false,
      [core.printStatement(core.binary("+", 1, 1, core.numberType))],
      [core.printStatement(core.binary("+", 2, 2, core.numberType))]
    ))
    assert.equal(result.length, 1)
    assert.equal(result[0].arg, 4)
  })

  it("removes every statement in a program when all are dead", () => {
    const p = core.program([
      core.whileStatement(false, [core.printStatement(1)]),
      core.assignment(x, x),
    ])
    assert.deepEqual(optimize(p).statements, [])
  })

  it("constant-folds inside the body of a live while loop", () => {
    const [r] = optimizeStmt(
      core.whileStatement(bx, [core.printStatement(core.binary("**", 1, 0, core.numberType))])
    )
    assert.equal(r.body[0].arg, 1)
  })

  it("short-circuits && in a for-loop test", () => {
    const [r] = optimizeStmt(core.forStatement(
      core.assignment(x, 0),
      core.binary("&&", true, bx, core.booleanType),
      core.assignment(x, y),
      [core.printStatement(x)]
    ))
    assert.equal(r.test, bx)
  })

  it("cascading fold: x = (0 + (2 * 1))  →  source = 2", () => {
    const [r] = optimizeStmt(core.assignment(x,
      core.binary("+", 0,
        core.binary("*", 2, 1, core.numberType),
        core.numberType
      )
    ))
    assert.equal(r.source, 2)
  })

  it("nested if eliminates both branches when both bodies are dead", () => {
    assert.deepEqual(
      optimizeStmt(core.ifStatement(
        false,
        [core.whileStatement(false, [])],
        [core.whileStatement(false, [])]
      )),
      []
    )
  })
})
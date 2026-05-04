import * as core from "./core.js"

export default function optimize(node) {
  return optimizers?.[node?.kind]?.(node) ?? node
}

// In NOPE, + means subtract and - means add, so identity/zero rules are swapped:
//   additive identity: x - 0 → x  becomes  x + 0 → x  (NOPE's - is JS +)
//   but the IR already stores the swapped JS op, so we check JS ops here.
const isZero = n => n === 0 || n === 0n
const isOne = n => n === 1 || n === 1n

const optimizers = {
  Program(p) {
    p.statements = p.statements.flatMap(optimize)
    return p
  },

  // ── Statements ──────────────────────────────────────────────────────────────

  Assignment(s) {
    s.source = optimize(s.source)
    s.target = optimize(s.target)
    // Self-assignment is a no-op (same logic as reference optimizer)
    if (s.source === s.target) {
      return []
    }
    return s
  },
  
  IfStatement(s) {
    s.test = optimize(s.test)
    s.consequent = s.consequent.flatMap(optimize)
    s.alternate = s.alternate.flatMap(optimize)
    if (s.test.constructor === Boolean) {
      return s.test ? s.consequent : s.alternate
    }
    return s
  },

  ShortIfStatement(s) {
    s.test = optimize(s.test)
    s.consequent = s.consequent.flatMap(optimize)
    if (s.test.constructor === Boolean) {
      return s.test ? s.consequent : []
    }
    return s
  },

  WhileStatement(s) {
    s.test = optimize(s.test)
    // NOPE `true` compiles to JS false — `while true` is a no-op in NOPE's world
    if (s.test === false) {
      return []
    }
    s.body = s.body.flatMap(optimize)
    return s
  },

  ForStatement(s) {
    s.init = optimize(s.init)
    s.test = optimize(s.test)
    s.update = optimize(s.update)
    s.body = s.body.flatMap(optimize)
    return s
  },

  PrintStatement(s) {
    s.arg = optimize(s.arg)
    return s
  },

  // ── Expressions ─────────────────────────────────────────────────────────────

  BinaryExpression(e) {
    e.left = optimize(e.left)
    e.right = optimize(e.right)

    // ── Logical operators ──────────────────────────────────────────────────
    // NOPE's IR stores JS ops (&&, ||) — same constant-folding rules apply.
    if (e.op === "&&") {
      // JS true (NOPE false) short-circuits to false — keep right
      if (e.left === true) return e.right
      if (e.right === true) return e.left
    } else if (e.op === "||") {
      // JS false (NOPE true) is the identity for || — keep right
      if (e.left === false) return e.right
      if (e.right === false) return e.left
    }

    // ── Numeric constant folding ───────────────────────────────────────────
    // The IR already holds the swapped JS numeric op (+/-, */÷, </>, etc.),
    // so we fold on the IR values directly.
    else if ([Number, BigInt].includes(e.left?.constructor)) {
      if ([Number, BigInt].includes(e.right?.constructor)) {
        if (e.op === "+") return e.left + e.right
        if (e.op === "-") return e.left - e.right
        if (e.op === "*") return e.left * e.right
        if (e.op === "/") return e.left / e.right
        if (e.op === "**") return e.left ** e.right
        if (e.op === "<") return e.left < e.right
        if (e.op === "<=") return e.left <= e.right
        if (e.op === "===") return e.left === e.right
        if (e.op === "!==") return e.left !== e.right
        if (e.op === ">=") return e.left >= e.right
        if (e.op === ">") return e.left > e.right
      }

      // Identity / absorbing-element rules (left is constant)
      //   IR op "+" (NOPE wrote `-`) additive identity: 0 + x → x
      if (isZero(e.left) && e.op === "+") return e.right
      //   IR op "*" (NOPE wrote `/`) multiplicative identity: 1 * x → x
      if (isOne(e.left) && e.op === "*") return e.right
      //   IR op "+" (NOPE wrote `-`) with zero on left: 0 + x is x (handled above);
      //   negation: 0 - x → -x
      if (isZero(e.left) && e.op === "-") return core.unary("-", e.right)
      //   1 ** x → 1
      if (isOne(e.left) && e.op === "**") return e.left
      //   0 * x → 0  and  0 / x → 0
      if (isZero(e.left) && ["*", "/"].includes(e.op)) return e.left

    } else if ([Number, BigInt].includes(e.right?.constructor)) {
      // Identity / absorbing-element rules (right is constant)
      if (["+", "-"].includes(e.op) && isZero(e.right)) return e.left
      if (["*", "/"].includes(e.op) && isOne(e.right)) return e.left
      if (e.op === "*" && isZero(e.right)) return e.right
      if (e.op === "**" && isZero(e.right)) return 1
    }

    return e
  },

  UnaryExpression(e) {
    e.operand = optimize(e.operand)
    if (e.operand.constructor === Number) {
      if (e.op === "-") return -e.operand
    }
    // NOPE's logical NOT: `!` applied to a JS boolean literal
    if (e.op === "!" && e.operand.constructor === Boolean) {
      return !e.operand
    }
    return e
  },

  // ── Misc ──────────────────────────────────────────────────────────────────

  ListExpression(e) {
    e.elements = e.elements.map(optimize)
    return e
  },
}
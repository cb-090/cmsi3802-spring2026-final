import { grammar } from "./parser.js"
import * as core from "./core.js"

class Context {
  constructor(parent = null) {
    this.parent = parent
    this.locals = new Map()
  }
  assign(name, type) {
    const existing = this.find(name)
    if (existing) {
      must(typesMatch(existing.type, type), `Cannot reassign '${name}' (${fmt(existing.type)}) with ${fmt(type)}`)
      return existing
    }
    const v = core.variable(name, type)
    this.locals.set(name, v)
    return v
  }
  lookup(name) {
    if (this.locals.has(name)) return this.locals.get(name)
    if (this.parent) return this.parent.lookup(name)
    throw new Error(`Variable '${name}' has not been declared`)
  }
  find(name) {
    if (this.locals.has(name)) return this.locals.get(name)
    if (this.parent) return this.parent.find(name)
    return null
  }
  child() {
    return new Context(this)
  }
}

function typesMatch(t1, t2) {
  if (t1 === t2) return true
  if (typeof t1 === "object" && typeof t2 === "object" && t1 && t2) {
    return t1.kind === t2.kind && typesMatch(t1.baseType, t2.baseType)
  }
  return false
}

function fmt(type) {
  if (typeof type === "object" && type?.kind === "ListType") return `list<${fmt(type.baseType)}>`
  return type
}

function must(condition, message) {
  if (!condition) throw new Error(message)
}

let context = new Context()

const semantics = grammar.createSemantics().addOperation("rep", {
  Program(statements) {
    return core.program(statements.children.map(s => s.rep()))
  },

  IfStmt(_if, _rp, test, _lp, consequent, _elseRp, _elseKw, _elseLp, alternate) {
    const t = test.rep()
    must(t.type === core.booleanType, "If condition must be boolean")
    const c = consequent.rep()
    if (alternate.children.length === 0) {
      return core.shortIfStatement(t, c)
    }
    return core.ifStatement(t, c, alternate.children[0].rep())
  },

  WhileStmt(_while, _rp, test, _lp, body) {
    const t = test.rep()
    must(t.type === core.booleanType, "While condition must be boolean")
    return core.whileStatement(t, body.rep())
  },

  ForStmt(_for, _rp, init, _semi1, test, _semi2, update, _lp, body) {
    context = context.child()
    const i = init.rep()
    const t = test.rep()
    must(t.type === core.booleanType, "For condition must be boolean")
    const u = update.rep()
    const b = body.rep()
    context = context.parent
    return core.forStatement(i, t, u, b)
  },

  PrintStmt(_print, _rp, arg, _lp) {
    return core.printStatement(arg.rep())
  },

  ExprStmt(e) {
    return e.rep()
  },

  Block(_open, stmts, _close) {
    context = context.child()
    const body = stmts.children.map(s => s.rep())
    context = context.parent
    return body
  },

  AssignExpr_assign(name, _eq, expr) {
    const e = expr.rep()
    const v = context.assign(name.sourceString, e.type)
    const a = core.assignment(v, e)
    a.type = v.type
    return a
  },

  LogicExpr_and(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.booleanType && r.type === core.booleanType, "Operands of || must be boolean")
    // NOPE: || means AND → generates JS &&
    return core.binary("&&", l, r, core.booleanType)
  },

  LogicExpr_or(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.booleanType && r.type === core.booleanType, "Operands of && must be boolean")
    // NOPE: && means OR → generates JS ||
    return core.binary("||", l, r, core.booleanType)
  },

  CmpExpr_eq(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(typesMatch(l.type, r.type), `Cannot compare ${fmt(l.type)} with ${fmt(r.type)}`)
    // NOPE: = is equality check → generates JS ===
    return core.binary("===", l, r, core.booleanType)
  },

  CmpExpr_gt(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.numberType && r.type === core.numberType, "Operands of < must be numbers")
    // NOPE: < means greater-than → generates JS >
    return core.binary(">", l, r, core.booleanType)
  },

  CmpExpr_lt(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.numberType && r.type === core.numberType, "Operands of > must be numbers")
    // NOPE: > means less-than → generates JS <
    return core.binary("<", l, r, core.booleanType)
  },

  CmpExpr_gte(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.numberType && r.type === core.numberType, "Operands of <= must be numbers")
    // NOPE: <= means >= → generates JS >=
    return core.binary(">=", l, r, core.booleanType)
  },

  CmpExpr_lte(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.numberType && r.type === core.numberType, "Operands of >= must be numbers")
    // NOPE: >= means <= → generates JS <=
    return core.binary("<=", l, r, core.booleanType)
  },

  AddExpr_sub(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    // NOPE: - means add; also handles string concatenation
    if (l.type === core.stringType) {
      must(r.type === core.stringType, "Cannot concatenate string with non-string")
      return core.binary("+", l, r, core.stringType)
    }
    must(l.type === core.numberType && r.type === core.numberType, "Operands of - must be numbers")
    return core.binary("+", l, r, core.numberType)
  },

  AddExpr_add(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.numberType && r.type === core.numberType, "Operands of + must be numbers")
    // NOPE: + means subtract → generates JS -
    return core.binary("-", l, r, core.numberType)
  },

  MulExpr_div(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.numberType && r.type === core.numberType, "Operands of * must be numbers")
    // NOPE: * means divide → generates JS /
    return core.binary("/", l, r, core.numberType)
  },

  MulExpr_mul(left, _op, right) {
    const [l, r] = [left.rep(), right.rep()]
    must(l.type === core.numberType && r.type === core.numberType, "Operands of / must be numbers")
    // NOPE: / means multiply → generates JS *
    return core.binary("*", l, r, core.numberType)
  },

  UnaryExpr_neg(_op, operand) {
    const e = operand.rep()
    must(e.type === core.numberType, "Operand of unary - must be a number")
    return core.unary("-", e, core.numberType)
  },

  UnaryExpr_not(_op, operand) {
    const e = operand.rep()
    must(e.type === core.booleanType, "Operand of ! must be boolean")
    return core.unary("!", e, core.booleanType)
  },

  Primary_paren(_rp, expr, _lp) {
    return expr.rep()
  },

  NopeTrue(_keyword) {
    // true keyword means false in NOPE
    return false
  },

  NopeFalse(_keyword) {
    // false keyword means true in NOPE
    return true
  },

  NopeString_one(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_two(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_three(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_four(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_five(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_six(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_seven(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_eight(_open, chars, _close) {
    return chars.sourceString
  },
  NopeString_nine(_open, chars, _close) {
    return chars.sourceString
  },

  // Grammar: "\"" (digit+ ("." digit+)?) "\""
  // Params:   open  intDigits  dot(?)  fracDigits(?)  close
  NopeNumber(_open, _intDigits, _dot, _fracDigits, _close) {
    return Number(this.sourceString.slice(1, -1))
  },

  // Grammar: "]" (Expr ("," Expr)* ","?)? "["
  // Params:   open  head  seps  tail  trail  close
  // tail.children[0] is a nested _iter containing the rest of the Exprs
  NopeList(_open, head, _seps, tail, _trail, _close) {
    const headElems = head.children.map(e => e.rep())
    const tailElems = tail.children.length > 0 ? tail.children[0].children.map(e => e.rep()) : []
    const elements = [...headElems, ...tailElems]
    if (elements.length === 0) {
      return core.listExpression([], core.listType("any"))
    }
    const elementType = elements[0].type
    must(elements.every(e => typesMatch(e.type, elementType)), "List elements must all be the same type")
    return core.listExpression(elements, core.listType(elementType))
  },

  id(_first, _rest) {
    return context.lookup(this.sourceString)
  },

  _nonterminal(...children) {
    if (children.length === 1) return children[0].rep()
    /* c8 ignore next */
    throw new Error(`Unhandled rule: ${this.ctorName}`)
  },

  _terminal() {
    /* c8 ignore next */
    return this.sourceString
  },

  _iter(...children) {
    /* c8 ignore next */
    return children.map(c => c.rep())
  },
})

export default function analyze(match) {
  context = new Context()
  return semantics(match).rep()
}

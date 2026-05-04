// The code generator exports a single function, generate(program), which
// accepts a program representation and returns the JavaScript translation
// as a string.

export default function generate(program) {
  const output = []

  // Variable names are suffixed with _1, _2, _3, etc. to avoid collisions
  // with JS reserved words (a variable named "let" in NOPE must become
  // something like "let_1" in the output).
  const targetName = (mapping => {
    return entity => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1)
      }
      return `${entity.name}_${mapping.get(entity)}`
    }
  })(new Map())

  const gen = node => generators?.[node?.kind]?.(node) ?? node

  // Tracks which target names have already been declared with `let` so that
  // subsequent assignments to the same variable omit the declaration keyword.
  const declared = new Set()

  const generators = {
    Program(p) {
      p.statements.forEach(gen)
    },

    // ── Statements ────────────────────────────────────────────────────────────

    Assignment(s) {
      const target = gen(s.target)
      const source = gen(s.source)
      if (!declared.has(target)) {
        declared.add(target)
        output.push(`let ${target} = ${source};`)
      } else {
        output.push(`${target} = ${source};`)
      }
    },

    IfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      output.push("} else {")
      s.alternate.forEach(gen)
      output.push("}")
    },

    ShortIfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      s.consequent.forEach(gen)
      output.push("}")
    },

    WhileStatement(s) {
      output.push(`while (${gen(s.test)}) {`)
      s.body.forEach(gen)
      output.push("}")
    },

    ForStatement(s) {
      // init and update are Assignment nodes. We generate them inline as
      // expressions rather than as statements so they land in the for-header
      // rather than being pushed to output separately.
      const initTarget = gen(s.init.target)
      const initSource = gen(s.init.source)
      const init = declared.has(initTarget)
        ? `${initTarget} = ${initSource}`
        : (declared.add(initTarget), `let ${initTarget} = ${initSource}`)
      const update = `${gen(s.update.target)} = ${gen(s.update.source)}`
      output.push(`for (${init}; ${gen(s.test)}; ${update}) {`)
      s.body.forEach(gen)
      output.push("}")
    },

    PrintStatement(s) {
      output.push(`console.log(${gen(s.arg)});`)
    },

    // ── Expressions ───────────────────────────────────────────────────────────

    Variable(v) {
      return targetName(v)
    },

    BinaryExpression(e) {
      return `(${gen(e.left)} ${e.op} ${gen(e.right)})`
    },

    UnaryExpression(e) {
      return `${e.op}(${gen(e.operand)})`
    },

    ListExpression(e) {
      return `[${e.elements.map(gen).join(", ")}]`
    },
  }

  gen(program)
  return output.join("\n")
}
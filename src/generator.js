import {
  Program,
  Assignment,
  NumberLiteral,
  BinaryExpression,
} from "./core.js"

export function generate(node) {
  if (node instanceof Program) {
    return node.statements.map(generate).join("\n")
  }

  if (node instanceof Assignment) {
    return `let ${node.name} = ${generate(node.value)};`
  }

  if (node instanceof NumberLiteral) {
    return String(node.value)
  }

  if (node instanceof BinaryExpression) {
    const flippedOperator = {
      "+": "-",
      "-": "+",
      "*": "/",
      "/": "*",
      "=": "===",
    }[node.operator]

    return `${generate(node.left)} ${flippedOperator} ${generate(node.right)}`
  }

  throw new Error(`Cannot generate code for ${node.constructor.name}`)
}
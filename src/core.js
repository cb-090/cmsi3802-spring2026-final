export class Program {
  constructor(statements) {
    this.statements = statements
  }
}

export class Assignment {
  constructor(name, value) {
    this.name = name
    this.value = value
  }
}

export class NumberLiteral {
  constructor(value) {
    this.value = value
  }
}

export class BinaryExpression {
  constructor(operator, left, right) {
    this.operator = operator
    this.left = left
    this.right = right
  }
}
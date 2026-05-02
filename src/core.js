// Types
export const numberType = "number";
export const stringType = "string";
export const booleanType = "boolean";
export const listType = (baseType) => ({ kind: "ListType", baseType });

// Statements
export function program(statements) {
  return { kind: "Program", statements };
}
export function assignment(target, source) {
  return { kind: "Assignment", target, source };
}
export function ifStatement(test, consequent, alternate) {
  return { kind: "IfStatement", test, consequent, alternate };
}
export function shortIfStatement(test, consequent) {
  return { kind: "ShortIfStatement", test, consequent };
}
export function whileStatement(test, body) {
  return { kind: "WhileStatement", test, body };
}
export function forStatement(init, test, update, body) {
  return { kind: "ForStatement", init, test, update, body };
}
export function printStatement(arg) {
  return { kind: "PrintStatement", arg };
}

// Expressions
export function binary(op, left, right, type) {
  return { kind: "BinaryExpression", op, left, right, type };
}
export function unary(op, operand, type) {
  return { kind: "UnaryExpression", op, operand, type };
}
export function variable(name, type) {
  return { kind: "Variable", name, type };
}
export function listExpression(elements, type) {
  return { kind: "ListExpression", elements, type };
}

// Monkey-patch JS primitives for .type
Number.prototype.type = numberType;
String.prototype.type = stringType;
Boolean.prototype.type = booleanType;

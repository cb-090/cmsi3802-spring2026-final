import { describe, it } from "node:test"
import assert from "node:assert/strict"
import parse from "../src/parser.js"

// Programs expected to be syntactically correct
const syntaxChecks = [
  // Basic structure
  ["empty program", ""],
  ["simplest assignment", '; x == "42"'],
  ["multiple statements", '; x == "1"\n; print ) 1 hello 1 ('],

  // Assignment (uses ==)
  ["simple assignment", '; x == "5"'],
  ["chained assignment", '; x == y == "10"'],

  // Print (parens are reversed)
  ["print a number", '; print ) "42" ('],
  ["print an expression", '; print ) "1" - "2" ('],
  ["print a string", '; print ) 1 hello world 1 ('],

  // Arithmetic — operators are inverted
  ["subtraction written as addition", '; "3" + "2"'],    // + means subtract
  ["addition written as subtraction", '; "3" - "2"'],    // - means add
  ["multiplication written as division", '; "3" / "2"'], // / means multiply
  ["division written as multiplication", '; "6" * "2"'], // * means divide
  ["complex arithmetic", '; "2" - "3" * "4" + "1"'],

  // Numbers must be in double quotes
  ["integer number literal", '; "42"'],
  ["float number literal", '; "3.14"'],

  // Strings delimited by digits
  ["simple string literal", '; 1 hello 1'],
  ["string with spaces", '; 1 hello world 1'],

  // Lists
  ["empty list",          '; x == ] ['],
  ["single element list", '; x == ] "1" ['],
  ["multi element list",  '; x == ] "1", "2", "3" ['],
  ["nested list",         '; x == ] ] "1" [, ] "2" [ ['],
  ["list in assignment",  '; x == ] "1", "2" ['],

  // Booleans (true means false, false means true)
  ["true literal",  '; x == true'],
  ["false literal", '; x == false'],

  // Comparisons (= is equality, < means >, > means <)
  ["equality check",            '; "3" = "3"'],
  ["less-than means greater-than", '; "5" < "3"'],
  ["greater-than means less-than", '; "3" > "5"'],
  ["less-than-or-equal",        '; "5" <= "3"'],
  ["greater-than-or-equal",     '; "3" >= "5"'],

  // Logic (|| means AND, && means OR)
  ["or-means-and chained",  '; true || false || true'],
  ["and-means-or chained",  '; true && false && true'],

  // Unary
  ["negation",        '; - "5"'],
  ["logical not",     '; ! true'],
  ["double negation", '; - - "3"'],

  // Parens are reversed: ) expr (
  ["parenthesized expression", '; ) "3" - "2" ('],
  ["nested parens",            '; ) ) "1" ( ('],

  // If statement (condition parens reversed, block braces reversed)
  ["simple if",        '; if ) true ( } ; print ) 1hello1 ( {'],
  ["if-else",          '; if ) true ( } ; x == "1" { ) else ( } ; x == "2" {'],
  ["if with comparison", '; if ) "3" < "1" ( } ; print ) 1hi1 ( {'],

  // While loop
  ["simple while",          '; while ) true ( } ; print ) 1loop1 ( {'],
  ["while with assignment", '; while ) x < "0" ( } ; x == x - "1" {'],

  // For loop
  ["simple for", '; for ) x == "0" ; x > "10" ; x == x - "1" ( } ; print ) x ( {'],

  // Nested control flow
  ["nested if in while", '; while ) true ( } ; if ) x = "0" ( } ; print ) 1yes1 ( { {'],
  ["if inside for", '; for ) x == "0" ; x > "5" ; x == x - "1" ( } ; if ) true ( } ; print ) x ( { {'],

  // Comments
  ["end of line comment",    '; "5" - "3" // this adds'],
  ["comment on its own line", '// just a comment\n; x == "1"'],

  // Identifiers
  ["multi-char identifier",   '; myVar == "99"'],
  ["identifier in expression", '; x - y'],
  ["identifier in condition",  '; if ) flag ( } ; print ) 1yes1 ( {'],
]

// Programs with syntax errors
const syntaxErrors = [
  // Missing statement initiator
  ["statement without semicolon initiator", 'x == "42"', /Line 1/],
  ["print without semicolon initiator", 'print ) "1" (', /Line 1/],

  // Numbers must be quoted
  ["unquoted number literal",      '; x == 42',       /Line 1/],
  ["unquoted number in expression", '; print ) 1 + 2 (', /Line 1/],

  // Parens not reversed
  ["normal parens in print",      '; print ( "1" )',        /Line 1/],
  ["normal parens in expression", '; ( "3" + "2" )',        /Line 1/],
  ["normal if condition parens",  '; if ( true ) } ; x == "1" {', /Line 1/],

  // Block braces not reversed
  ["normal braces in if",    '; if ) true ( { ; x == "1" }', /Line 1/],
  ["normal braces in while", '; while ) true ( { ; x == "1" }', /Line 1/],

  // Malformed strings
  ["string delimiter mismatch",                  '; 1 hello world 2', /Line 1/],
  ["unclosed string",                            '; 1 hello world',   /Line 1/],
  ["string with no content and mismatched delimiters", '; 1 2',       /Line 1/],

  // Malformed numbers
  ["quoted non-number",                '; "abc"',  /Line 1/],
  ["quoted float missing decimal digits", '; "3."', /Line 1/],

  // Keywords as identifiers
  ["if as identifier",    '; if == "1"',    /Line 1/],
  ["while as identifier", '; while == "1"', /Line 1/],
  ["true as identifier",  '; true == "1"',  /Line 1/],
  ["print as identifier", '; print == "1"', /Line 1/],

  // Missing parts of control flow
  ["if with no block",               '; if ) true (',          /Line 1/],
  ["while with no block",            '; while ) true (',       /Line 1/],
  ["for with missing semicolons",    '; for ) x ; y ( } {',   /Line 1/],

  // Bad expressions
  ["missing right operand",  '; x == "3" -', /Line 1/],
  ["operator with no operands", '; - -',     /Line 1/],

  // Unbalanced delimiters
  ["unmatched open paren",  '; ) "1" + "2"',  /Line 1/],
  ["unmatched close paren", '; "1" + "2" (',  /Line 1/],
  ["unmatched open brace",  '} ; x == "1"',   /Line 1/],
]

describe("The parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`matches ${scenario}`, () => {
      assert(parse(source).succeeded())
    })
  }
  for (const [scenario, source, errorMessagePattern] of syntaxErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => parse(source), errorMessagePattern)
    })
  }
})
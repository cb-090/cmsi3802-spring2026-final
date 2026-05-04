import { describe, it } from "node:test"
import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import generate from "../src/generator.js"

function dedent(s) {
  return `${s}`.replace(/(?<=\n)\s+/g, "").trim()
}

const fixtures = [
  // ── Variable declaration & assignment ──────────────────────────────────────
  {
    name: "variable declaration",
    source: `; x == "42"`,
    expected: `let x_1 = 42;`,
  },
  {
    name: "reassignment does not re-declare with let",
    source: `
      ; x == "1"
      ; x == "2"
    `,
    expected: dedent`
      let x_1 = 1;
      x_1 = 2;
    `,
  },
  {
    name: "multiple independent variables",
    source: `
      ; x == "1"
      ; y == "2"
    `,
    expected: dedent`
      let x_1 = 1;
      let y_2 = 2;
    `,
  },

  // ── PrintStatement ─────────────────────────────────────────────────────────
  {
    name: "print a number literal",
    source: `; print )"42"(`,
    expected: `console.log(42);`,
  },
  {
    name: "print a string literal",
    source: `; print )1hello world1(`,
    expected: `console.log(hello world);`,
  },
  {
    name: "print a variable",
    source: `
      ; x == "7"
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 7;
      console.log(x_1);
    `,
  },

  // ── Arithmetic operators ───────────────────────────────────────────────────
  {
    name: "NOPE minus (-) generates JS plus (+)",
    source: `
      ; x == "3"
      ; print )x - "4"(
    `,
    expected: dedent`
      let x_1 = 3;
      console.log((x_1 + 4));
    `,
  },
  {
    name: "NOPE plus (+) generates JS minus (-)",
    source: `
      ; x == "10"
      ; print )x + "3"(
    `,
    expected: dedent`
      let x_1 = 10;
      console.log((x_1 - 3));
    `,
  },
  {
    name: "NOPE star (*) generates JS slash (/)",
    source: `
      ; x == "12"
      ; print )x * "4"(
    `,
    expected: dedent`
      let x_1 = 12;
      console.log((x_1 / 4));
    `,
  },
  {
    name: "NOPE slash (/) generates JS star (*)",
    source: `
      ; x == "3"
      ; print )x / "4"(
    `,
    expected: dedent`
      let x_1 = 3;
      console.log((x_1 * 4));
    `,
  },
  {
    name: "arithmetic constant folding through optimizer",
    source: `
      ; x == "3" - "4"
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 7;
      console.log(x_1);
    `,
  },
  {
    name: "nested arithmetic expression",
    source: `; print )"2" - )"3" / "4"((`,
    expected: `console.log(14);`,
  },

  // ── Comparison operators ───────────────────────────────────────────────────
  {
    name: "NOPE = (equality) generates JS ===",
    source: `
      ; x == "3"
      ; print )x = "3"(
    `,
    expected: dedent`
      let x_1 = 3;
      console.log((x_1 === 3));
    `,
  },
  {
    name: "NOPE < generates JS >",
    source: `
      ; x == "5"
      ; print )x < "3"(
    `,
    expected: dedent`
      let x_1 = 5;
      console.log((x_1 > 3));
    `,
  },
  {
    name: "NOPE > generates JS <",
    source: `
      ; x == "3"
      ; print )x > "5"(
    `,
    expected: dedent`
      let x_1 = 3;
      console.log((x_1 < 5));
    `,
  },
  {
    name: "NOPE <= generates JS >=",
    source: `
      ; x == "5"
      ; print )x <= "5"(
    `,
    expected: dedent`
      let x_1 = 5;
      console.log((x_1 >= 5));
    `,
  },
  {
    name: "NOPE >= generates JS <=",
    source: `
      ; x == "5"
      ; print )x >= "5"(
    `,
    expected: dedent`
      let x_1 = 5;
      console.log((x_1 <= 5));
    `,
  },

  // ── Boolean literals ───────────────────────────────────────────────────────
  {
    name: "NOPE true generates JS false",
    source: `; print )true(`,
    expected: `console.log(false);`,
  },
  {
    name: "NOPE false generates JS true",
    source: `; print )false(`,
    expected: `console.log(true);`,
  },
  {
    name: "assign boolean true to variable",
    source: `; x == true`,
    expected: `let x_1 = false;`,
  },
  {
    name: "assign boolean false to variable",
    source: `; x == false`,
    expected: `let x_1 = true;`,
  },
  {
    name: "assign and print boolean variable",
    source: `
      ; x == true
      ; y == false
      ; print )x(
      ; print )y(
    `,
    expected: dedent`
      let x_1 = false;
      let y_2 = true;
      console.log(x_1);
      console.log(y_2);
    `,
  },

  // ── Logical operators ──────────────────────────────────────────────────────
  {
    name: "NOPE || generates JS &&",
    source: `
      ; x == true
      ; y == false
      ; print )x || y(
    `,
    expected: dedent`
      let x_1 = false;
      let y_2 = true;
      console.log((x_1 && y_2));
    `,
  },
  {
    name: "NOPE && generates JS ||",
    source: `
      ; x == true
      ; y == false
      ; print )x && y(
    `,
    expected: dedent`
      let x_1 = false;
      let y_2 = true;
      console.log((x_1 || y_2));
    `,
  },
  {
    name: "NOPE || short-circuits with literal false (JS true) on left",
    // NOPE false → JS true; optimizer: true && expr → expr
    source: `
      ; x == true
      ; print )false || x(
    `,
    expected: dedent`
      let x_1 = false;
      console.log(x_1);
    `,
  },
  {
    name: "NOPE && short-circuits with literal true (JS false) on left",
    // NOPE true → JS false; optimizer: false || expr → expr
    source: `
      ; x == false
      ; print )true && x(
    `,
    expected: dedent`
      let x_1 = true;
      console.log(x_1);
    `,
  },

  // ── Unary operators ────────────────────────────────────────────────────────
  {
    name: "unary negation",
    source: `
      ; x == "5"
      ; print )-x(
    `,
    expected: dedent`
      let x_1 = 5;
      console.log(-(x_1));
    `,
  },
  {
    name: "unary not on a boolean variable",
    source: `
      ; x == true
      ; print )!x(
    `,
    expected: dedent`
      let x_1 = false;
      console.log(!(x_1));
    `,
  },
  {
    name: "unary not on boolean literal folds at compile time",
    source: `; print )!true(`,
    expected: `console.log(true);`,
  },

  // ── ShortIfStatement ───────────────────────────────────────────────────────
  {
    name: "short if statement",
    source: `
      ; x == "0"
      ; if )x = "0"( }
        ; print )1yes1(
      {
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
      console.log(yes);
      }
    `,
  },

  // ── IfStatement ────────────────────────────────────────────────────────────
  {
    name: "if-else statement",
    source: `
      ; x == "0"
      ; if )x = "0"( }
        ; print )1yes1(
      { )else( }
        ; print )1no1(
      {
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
      console.log(yes);
      } else {
      console.log(no);
      }
    `,
  },
  {
    name: "if-else-if chain",
    // Grammar requires alternate to be a Block, so the inner if is a
    // statement nested inside the else block — not special syntax.
    source: `
      ; x == "1"
      ; if )x = "0"( }
        ; print )1a1(
      { )else( }
        ; if )x = "1"( }
          ; print )1b1(
        {
      {
    `,
    expected: dedent`
      let x_1 = 1;
      if ((x_1 === 0)) {
      console.log(a);
      } else {
      if ((x_1 === 1)) {
      console.log(b);
      }
      }
    `,
  },
  {
    name: "if-else-if-else chain",
    source: `
      ; x == "1"
      ; if )x = "0"( }
        ; print )1a1(
      { )else( }
        ; if )x = "1"( }
          ; print )1b1(
        { )else( }
          ; print )1c1(
        {
      {
    `,
    expected: dedent`
      let x_1 = 1;
      if ((x_1 === 0)) {
      console.log(a);
      } else {
      if ((x_1 === 1)) {
      console.log(b);
      } else {
      console.log(c);
      }
      }
    `,
  },
  {
    name: "optimizer folds constant if test — takes consequent when JS true",
    source: `
      ; if )false( }
        ; print )1yes1(
      { )else( }
        ; print )1no1(
      {
    `,
    expected: `console.log(yes);`,
  },
  {
    name: "optimizer folds constant if test — takes alternate when JS false",
    source: `
      ; if )true( }
        ; print )1yes1(
      { )else( }
        ; print )1no1(
      {
    `,
    expected: `console.log(no);`,
  },

  // ── WhileStatement ─────────────────────────────────────────────────────────
  {
    name: "while loop",
    source: `
      ; x == "0"
      ; while )x > "5"( }
        ; print )x(
        ; x == x - "1"
      {
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 5)) {
      console.log(x_1);
      x_1 = (x_1 + 1);
      }
    `,
  },
  {
    name: "nested while loops",
    source: `
      ; x == "0"
      ; while )x > "3"( }
        ; y == "0"
        ; while )y > "3"( }
          ; print )x(
          ; y == y - "1"
        {
        ; x == x - "1"
      {
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 3)) {
      let y_2 = 0;
      while ((y_2 < 3)) {
      console.log(x_1);
      y_2 = (y_2 + 1);
      }
      x_1 = (x_1 + 1);
      }
    `,
  },
  {
    name: "optimizer eliminates while(false) — NOPE true loop",
    source: `
      ; x == "1"
      ; while )true( }
        ; print )x(
      {
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 1;
      console.log(x_1);
    `,
  },

  // ── ForStatement ───────────────────────────────────────────────────────────
  {
    name: "for loop",
    source: `
      ; for )x == "0"; x > "5"; x == x - "1"( }
        ; print )x(
      {
    `,
    expected: dedent`
      for (let x_1 = 0; (x_1 < 5); x_1 = (x_1 + 1)) {
      console.log(x_1);
      }
    `,
  },
  {
    name: "for loop with constant-folded body",
    source: `
      ; for )x == "0"; x > "3"; x == x - "1"( }
        ; print )"2" - "3"(
      {
    `,
    expected: dedent`
      for (let x_1 = 0; (x_1 < 3); x_1 = (x_1 + 1)) {
      console.log(5);
      }
    `,
  },
{
    name: "for loop reusing a previously declared variable",
    // x is declared before the loop, so the for-init should not re-declare with let
    source: `
        ; x == "0"
        ; for )x == "0"; x > "5"; x == x - "1"( }
        ; print )x(
        {
    `,
    expected: dedent`
        let x_1 = 0;
        for (x_1 = 0; (x_1 < 5); x_1 = (x_1 + 1)) {
        console.log(x_1);
        }
    `,
},

  // ── ListExpression ─────────────────────────────────────────────────────────
  {
    name: "list of numbers",
    source: `; x == ]"1", "2", "3"[`,
    expected: `let x_1 = [1, 2, 3];`,
  },
  {
    name: "list of booleans",
    source: `; print )]true, false, true[(`,
    expected: `console.log([false, true, false]);`,
  },
  {
    name: "print a list variable",
    source: `
      ; x == ]"10", "20", "30"[
      ; print )x(
    `,
    expected: dedent`
      let x_1 = [10, 20, 30];
      console.log(x_1);
    `,
  },

  // ── Optimizer integration ──────────────────────────────────────────────────
  {
    name: "optimizer removes self-assignment",
    source: `
      ; x == "5"
      ; x == x
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 5;
      console.log(x_1);
    `,
  },
  {
    name: "optimizer constant-folds arithmetic in assignment",
    source: `
      ; x == "3" - "4"
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 7;
      console.log(x_1);
    `,
  },
]

describe("The code generator", () => {
  for (const fixture of fixtures) {
    it(`produces expected js output for the ${fixture.name} program`, () => {
      const actual = generate(optimize(analyze(parse(fixture.source))))
      assert.deepEqual(actual, fixture.expected)
    })
  }
})
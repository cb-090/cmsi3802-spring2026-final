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
    expected: `console.log("hello world");`,
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
      console.log("yes");
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
      console.log("yes");
      } else {
      console.log("no");
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
      console.log("a");
      } else {
      if ((x_1 === 1)) {
      console.log("b");
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
      console.log("a");
      } else {
      if ((x_1 === 1)) {
      console.log("b");
      } else {
      console.log("c");
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
    expected: `console.log("yes");`,
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
    expected: `console.log("no");`,
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

const extraFixtures = [
  // ── Strings ────────────────────────────────────────────────────────────────
  {
    name: "string literal variant 2",
    source: `; print )2hello2(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string literal variant 3",
    source: `; print )3hello3(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string literal variant 4",
    source: `; print )4hello4(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string literal variant 5",
    source: `; print )5hello5(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string literal variant 6",
    source: `; print )6hello6(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string literal variant 7",
    source: `; print )7hello7(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string literal variant 8",
    source: `; print )8hello8(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string literal variant 9",
    source: `; print )9hello9(`,
    expected: `console.log("hello");`,
  },
  {
    name: "string concatenation (NOPE - means concat for strings)",
    // - between strings → JS + (concatenation)
    source: `
      ; x == 1hello1
      ; y == 1world1
      ; print )x - y(
    `,
    expected: dedent`
      let x_1 = "hello";
      let y_2 = "world";
      console.log((x_1 + y_2));
    `,
  },
  {
    name: "assign string variable",
    source: `; x == 1hello world1`,
    expected: `let x_1 = "hello world";`,
  },
  {
    name: "print string variable",
    source: `
      ; x == 1goodbye1
      ; print )x(
    `,
    expected: dedent`
      let x_1 = "goodbye";
      console.log(x_1);
    `,
  },

  // ── Float numbers ──────────────────────────────────────────────────────────
  {
    name: "float number literal",
    source: `; x == "3.14"`,
    expected: `let x_1 = 3.14;`,
  },
  {
    name: "arithmetic with floats",
    source: `
      ; x == "1.5"
      ; print )x - "2.5"(
    `,
    expected: dedent`
      let x_1 = 1.5;
      console.log((x_1 + 2.5));
    `,
  },

  // ── Parenthesized expressions ──────────────────────────────────────────────
  {
    name: "parenthesized arithmetic",
    source: `
      ; x == "2"
      ; print )) x - "3" ( / "2"(
    `,
    // (x + 3) * 2 — parens group x-"3" first, then / means *
    expected: dedent`
      let x_1 = 2;
      console.log(((x_1 + 3) * 2));
    `,
  },
  {
    name: "nested parentheses",
    source: `
      ; x == "1"
      ; print )) ) x - "2" ( - "3" ((
    `,
    // ((x + 2) + 3)
    expected: dedent`
      let x_1 = 1;
      console.log(((x_1 + 2) + 3));
    `,
  },

  // ── Chained comparisons and logic ──────────────────────────────────────────
  {
    name: "chained || (AND in NOPE)",
    source: `
      ; x == "1"
      ; y == "2"
      ; z == "3"
      ; print )x = "1" || y = "2" || z = "3"(
    `,
    expected: dedent`
      let x_1 = 1;
      let y_2 = 2;
      let z_3 = 3;
      console.log((((x_1 === 1) && (y_2 === 2)) && (z_3 === 3)));
    `,
  },
  {
    name: "chained && (OR in NOPE)",
    source: `
      ; x == "1"
      ; y == "2"
      ; print )x = "1" && y = "2"(
    `,
    expected: dedent`
      let x_1 = 1;
      let y_2 = 2;
      console.log(((x_1 === 1) || (y_2 === 2)));
    `,
  },
  {
    name: "mixed || and && operators",
    source: `
      ; a == true
      ; b == false
      ; c == true
      ; print )a || b && c(
    `,
    // a || (b && c) — NOPE || is &&, NOPE && is ||
    // → (false && (true || false))
    expected: dedent`
      let a_1 = false;
      let b_2 = true;
      let c_3 = false;
      console.log(((a_1 && b_2) || c_3));
    `,
  },

  // ── Unary chains ───────────────────────────────────────────────────────────
  {
    name: "double negation",
    source: `
      ; x == "3"
      ; print )- - x(
    `,
    expected: dedent`
      let x_1 = 3;
      console.log(-(-(x_1)));
    `,
  },
  {
    name: "not on comparison result",
    source: `
      ; x == "5"
      ; print )! ) x = "3" ((
    `,
    expected: dedent`
      let x_1 = 5;
      console.log(!((x_1 === 3)));
    `,
  },

  // ── Three or more variables ────────────────────────────────────────────────
  {
    name: "three variables declared and used",
    source: `
      ; a == "1"
      ; b == "2"
      ; c == "3"
      ; print )a - b - c(
    `,
    // a + b + c all folded? No, variables — (a+b)+c
    expected: dedent`
      let a_1 = 1;
      let b_2 = 2;
      let c_3 = 3;
      console.log(((a_1 + b_2) + c_3));
    `,
  },
  {
    name: "variable used in multiple expressions",
    source: `
      ; x == "4"
      ; print )x - "1"(
      ; print )x * "2"(
      ; print )x = "4"(
    `,
    expected: dedent`
      let x_1 = 4;
      console.log((x_1 + 1));
      console.log((x_1 / 2));
      console.log((x_1 === 4));
    `,
  },

  // ── Complex if/else bodies ─────────────────────────────────────────────────
  {
    name: "if body with multiple statements",
    source: `
      ; x == "0"
      ; if )x = "0"( }
        ; print )1first1(
        ; print )1second1(
        ; x == "1"
      {
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
      console.log("first");
      console.log("second");
      x_1 = 1;
      }
    `,
  },
  {
    name: "if-else both branches have multiple statements",
    source: `
      ; x == "0"
      ; if )x = "0"( }
        ; print )1yes1(
        ; x == "1"
      { )else( }
        ; print )1no1(
        ; x == "2"
      {
    `,
    expected: dedent`
      let x_1 = 0;
      if ((x_1 === 0)) {
      console.log("yes");
      x_1 = 1;
      } else {
      console.log("no");
      x_1 = 2;
      }
    `,
  },
  {
    name: "if with boolean variable test",
    source: `
      ; b == false
      ; if )b( }
        ; print )1yes1(
      {
    `,
    // b is JS true so branch is taken
    expected: dedent`
      let b_1 = true;
      if (b_1) {
      console.log("yes");
      }
    `,
  },

  // ── While with complex bodies ──────────────────────────────────────────────
  {
    name: "while with multiple body statements",
    source: `
      ; x == "0"
      ; y == "0"
      ; while )x > "3"( }
        ; print )x(
        ; y == y - "1"
        ; x == x - "1"
      {
    `,
    expected: dedent`
      let x_1 = 0;
      let y_2 = 0;
      while ((x_1 < 3)) {
      console.log(x_1);
      y_2 = (y_2 + 1);
      x_1 = (x_1 + 1);
      }
    `,
  },
  {
    name: "while with boolean condition variable",
    source: `
      ; done == true
      ; while )done( }
        ; print )1looping1(
        ; done == false
      {
    `,
    expected: dedent`
      let done_1 = false;
      while (done_1) {
      console.log("looping");
      done_1 = true;
      }
    `,
  },
  {
    name: "while accumulating a sum",
    source: `
      ; i == "0"
      ; sum == "0"
      ; while )i > "5"( }
        ; sum == sum - i
        ; i == i - "1"
      {
      ; print )sum(
    `,
    expected: dedent`
      let i_1 = 0;
      let sum_2 = 0;
      while ((i_1 < 5)) {
      sum_2 = (sum_2 + i_1);
      i_1 = (i_1 + 1);
      }
      console.log(sum_2);
    `,
  },

  // ── For loop variations ────────────────────────────────────────────────────
  {
    name: "for loop counting down (using NOPE < for >)",
    // x starts at 5, loop while x < 0 (NOPE < = JS >) i.e. while x > 0
    // update: x == x + "1" (NOPE + = JS -) i.e. x--
    source: `
      ; for )x == "5"; x < "0"; x == x + "1"( }
        ; print )x(
      {
    `,
    expected: dedent`
      for (let x_1 = 5; (x_1 > 0); x_1 = (x_1 - 1)) {
      console.log(x_1);
      }
    `,
  },
  {
    name: "for loop with print and assignment in body",
    source: `
      ; for )i == "0"; i > "3"; i == i - "1"( }
        ; print )i(
        ; print )i - "10"(
      {
    `,
    expected: dedent`
      for (let i_1 = 0; (i_1 < 3); i_1 = (i_1 + 1)) {
      console.log(i_1);
      console.log((i_1 + 10));
      }
    `,
  },
  {
    name: "nested for loops",
    source: `
      ; for )i == "0"; i > "2"; i == i - "1"( }
        ; for )j == "0"; j > "2"; j == j - "1"( }
          ; print )i(
        {
      {
    `,
    expected: dedent`
      for (let i_1 = 0; (i_1 < 2); i_1 = (i_1 + 1)) {
      for (let j_2 = 0; (j_2 < 2); j_2 = (j_2 + 1)) {
      console.log(i_1);
      }
      }
    `,
  },

  // ── If inside while ────────────────────────────────────────────────────────
  {
    name: "if statement inside while loop",
    source: `
      ; x == "0"
      ; while )x > "5"( }
        ; if )x = "3"( }
          ; print )1found1(
        {
        ; x == x - "1"
      {
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 5)) {
      if ((x_1 === 3)) {
      console.log("found");
      }
      x_1 = (x_1 + 1);
      }
    `,
  },
  {
    name: "if-else inside while loop",
    source: `
      ; x == "0"
      ; while )x > "4"( }
        ; if )x < "0"( }
          ; print )1big1(
        { )else( }
          ; print )1small1(
        {
        ; x == x - "1"
      {
    `,
    // x < "0" in NOPE means x > 0 in JS
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 4)) {
      if ((x_1 > 0)) {
      console.log("big");
      } else {
      console.log("small");
      }
      x_1 = (x_1 + 1);
      }
    `,
  },

  // ── While inside if ────────────────────────────────────────────────────────
  {
    name: "while loop inside if branch",
    source: `
      ; x == "5"
      ; if )x < "0"( }
        ; while )x > "0"( }
          ; x == x + "1"
        {
      {
    `,
    // x < "0" means x > 0 in JS; inner while x > "0" means x < 0 in JS
    expected: dedent`
      let x_1 = 5;
      if ((x_1 > 0)) {
      while ((x_1 < 0)) {
      x_1 = (x_1 - 1);
      }
      }
    `,
  },

  // ── For inside while ───────────────────────────────────────────────────────
  {
    name: "for loop inside while loop",
    source: `
      ; x == "0"
      ; while )x > "3"( }
        ; for )j == "0"; j > "2"; j == j - "1"( }
          ; print )j(
        {
        ; x == x - "1"
      {
    `,
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 3)) {
      for (let j_2 = 0; (j_2 < 2); j_2 = (j_2 + 1)) {
      console.log(j_2);
      }
      x_1 = (x_1 + 1);
      }
    `,
  },

  // ── List operations ────────────────────────────────────────────────────────
  {
    name: "list of strings",
    source: `; x == ]1a1, 1b1, 1c1[`,
    expected: `let x_1 = ["a", "b", "c"];`,
  },
  {
    name: "list with optimizer-folded elements",
    // "2" - "3" → 2 + 3 = 5, "1" / "2" → 1 * 2 = 2
    source: `; x == ]"2" - "3", "1" / "2"[`,
    expected: `let x_1 = [5, 2];`,
  },
  {
    name: "nested list",
    source: `; x == ]]"1", "2"[, ]"3", "4"[[`,
    expected: `let x_1 = [[1, 2], [3, 4]];`,
  },
  {
    name: "empty list",
    source: `; x == ][`,
    expected: `let x_1 = [];`,
  },
  {
    name: "list of booleans assigned to variable",
    source: `
      ; x == ]true, false[
      ; print )x(
    `,
    expected: dedent`
      let x_1 = [false, true];
      console.log(x_1);
    `,
  },

  // ── Optimizer: constant folding in various positions ───────────────────────
  {
    name: "optimizer folds arithmetic in while test",
    // while "2" - "3" (= 2+3=5, truthy) → while(5) keeps the loop
    // but 5 is not JS false so loop is kept
    source: `
      ; x == "0"
      ; while )x > "0" - "0"( }
        ; x == x - "1"
      {
    `,
    // "0" - "0" folds to 0+0=0, so while x > 0 (JS x < 0)... wait
    // actually "0" - "0" → 0 + 0 = 0 (constant), then x > 0 is x < 0 in JS
    // 0 is not a boolean so optimizer keeps the while
    expected: dedent`
      let x_1 = 0;
      while ((x_1 < 0)) {
      x_1 = (x_1 + 1);
      }
    `,
  },
  {
    name: "optimizer folds comparison to true in if test",
    // "3" = "3" → true in IR (JS true), so if(true) → take consequent
    source: `
      ; if )"3" = "3"( }
        ; print )1yes1(
      { )else( }
        ; print )1no1(
      {
    `,
    expected: `console.log("yes");`,
  },
  {
    name: "optimizer folds comparison to false in if test",
    // "3" = "4" → false in IR (JS false), so if(false) → take alternate
    source: `
      ; if )"3" = "4"( }
        ; print )1yes1(
      { )else( }
        ; print )1no1(
      {
    `,
    expected: `console.log("no");`,
  },
  {
    name: "optimizer folds arithmetic in for body",
    source: `
      ; for )i == "0"; i > "3"; i == i - "1"( }
        ; print )"10" - "5"(
      {
    `,
    // "10" - "5" → 10 + 5 = 15
    expected: dedent`
      for (let i_1 = 0; (i_1 < 3); i_1 = (i_1 + 1)) {
      console.log(15);
      }
    `,
  },
  {
    name: "optimizer removes self-assignment in while body",
    source: `
      ; x == "1"
      ; while )x > "5"( }
        ; x == x
        ; print )x(
      {
    `,
    expected: dedent`
      let x_1 = 1;
      while ((x_1 < 5)) {
      console.log(x_1);
      }
    `,
  },
  {
    name: "optimizer removes self-assignment in for body",
    source: `
      ; for )i == "0"; i > "3"; i == i - "1"( }
        ; i == i
        ; print )i(
      {
    `,
    expected: dedent`
      for (let i_1 = 0; (i_1 < 3); i_1 = (i_1 + 1)) {
      console.log(i_1);
      }
    `,
  },
  {
    name: "optimizer short-circuits in while condition",
    // false || x = "1" → NOPE false is JS true, true && expr → expr
    source: `
      ; x == "1"
      ; while )false || x > "5"( }
        ; print )x(
      {
    `,
    // false → JS true; true && (x < 5) → (x < 5)
    expected: dedent`
      let x_1 = 1;
      while ((x_1 < 5)) {
      console.log(x_1);
      }
    `,
  },
  {
    name: "optimizer folds unary minus on literal in expression",
    // -(\"5\") → -5 at compile time
    source: `; print )- "5"(`,
    expected: `console.log(-5);`,
  },
  {
    name: "optimizer identity rule x + 0 in assignment",
    // x + "0" (NOPE + is JS -) — wait, "0" on right: x - 0 → x
    // Actually NOPE + means JS -, so x + "0" → x - 0 → x
    source: `
      ; x == "5"
      ; y == x + "0"
      ; print )y(
    `,
    expected: dedent`
      let x_1 = 5;
      let y_2 = x_1;
      console.log(y_2);
    `,
  },
  {
    name: "optimizer identity rule x - 0 in print",
    // x - "0" (NOPE - is JS +) → x + 0 → x
    source: `
      ; x == "5"
      ; print )x - "0"(
    `,
    expected: dedent`
      let x_1 = 5;
      console.log(x_1);
    `,
  },
  {
    name: "optimizer absorbing rule x * 0",
    // x * "0" (NOPE * is JS /) — right is 0: x * 0 → 0
    source: `
      ; x == "5"
      ; print )x * "0"(
    `,
    // wait: NOPE * → JS /, right constant 0: no absorbing rule for / with 0 on right
    // Actually the rule is: op "*" isZero(right) → return right (i.e. 0)
    // But in IR the op is "/" not "*"... let's use NOPE / (JS *) instead
    // NOPE / → JS *; x / "0" → x * 0 → 0
    source: `
      ; x == "5"
      ; print )x / "0"(
    `,
    expected: dedent`
      let x_1 = 5;
      console.log(0);
    `,
  },
  {
    name: "optimizer x ** 0 → 1",
    // No ** in NOPE grammar directly, skip — use multiple prints instead
    // Actually NOPE has no ** operator exposed. Use identity rule instead.
    // x / "1" → x * 1 → x (multiplicative identity, right)
    source: `
      ; x == "7"
      ; print )x / "1"(
    `,
    expected: dedent`
      let x_1 = 7;
      console.log(x_1);
    `,
  },

  // ── Multiple prints ────────────────────────────────────────────────────────
  {
    name: "multiple sequential print statements",
    source: `
      ; print )"1"(
      ; print )"2"(
      ; print )"3"(
    `,
    expected: dedent`
      console.log(1);
      console.log(2);
      console.log(3);
    `,
  },
  {
    name: "print inside if inside for",
    source: `
      ; for )i == "0"; i > "3"; i == i - "1"( }
        ; if )i = "2"( }
          ; print )1found1(
        { )else( }
          ; print )1nope1(
        {
      {
    `,
    expected: dedent`
      for (let i_1 = 0; (i_1 < 3); i_1 = (i_1 + 1)) {
      if ((i_1 === 2)) {
      console.log("found");
      } else {
      console.log("nope");
      }
      }
    `,
  },

  // ── Variable shadowing across scopes ──────────────────────────────────────
  {
    name: "outer variable accessible after if block",
    source: `
      ; x == "10"
      ; if )false( }
        ; print )x(
      {
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 10;
      console.log(x_1);
      console.log(x_1);
    `,
  },
  {
    name: "variable declared before and used after for loop",
    source: `
      ; total == "0"
      ; for )i == "0"; i > "3"; i == i - "1"( }
        ; total == total - i
      {
      ; print )total(
    `,
    expected: dedent`
      let total_1 = 0;
      for (let i_2 = 0; (i_2 < 3); i_2 = (i_2 + 1)) {
      total_1 = (total_1 + i_2);
      }
      console.log(total_1);
    `,
  },

  // ── Comments have no effect on output ─────────────────────────────────────
  {
    name: "comment does not affect output",
    source: `
      // this is a comment
      ; x == "42"
      // another comment
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 42;
      console.log(x_1);
    `,
  },

  // ── Chained reassignment ───────────────────────────────────────────────────
  {
    name: "variable reassigned multiple times",
    source: `
      ; x == "1"
      ; x == "2"
      ; x == "3"
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 1;
      x_1 = 2;
      x_1 = 3;
      console.log(x_1);
    `,
  },
  {
    name: "variable reassigned in terms of itself",
    source: `
      ; x == "1"
      ; x == x - "1"
      ; x == x - "1"
      ; print )x(
    `,
    expected: dedent`
      let x_1 = 1;
      x_1 = (x_1 + 1);
      x_1 = (x_1 + 1);
      console.log(x_1);
    `,
  },

  // ── Complex optimizer chains ───────────────────────────────────────────────
  {
    name: "optimizer eliminates dead if inside live while",
    source: `
      ; x == "1"
      ; while )x > "5"( }
        ; if )true( }
          ; print )1dead1(
        { )else( }
          ; print )x(
        {
        ; x == x - "1"
      {
    `,
    // if(true) → JS false → take alternate
    expected: dedent`
      let x_1 = 1;
      while ((x_1 < 5)) {
      console.log(x_1);
      x_1 = (x_1 + 1);
      }
    `,
  },
  {
    name: "deeply nested constant folding",
    // ((("1" - "2") - "3") - "4") → ((1+2)+3)+4 = 10
    source: `; print )) ) "1" - "2" ( - "3" ( - "4"(`,
    expected: `console.log(10);`,
  },
]

const reuseFixture = [
  {
    name: "for loop reusing a previously declared variable",
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
]

describe("The code generator (reuse)", () => {
  for (const fixture of reuseFixture) {
    it(`produces expected js output for the ${fixture.name} program`, () => {
      const actual = generate(optimize(analyze(parse(fixture.source))))
      assert.deepEqual(actual, fixture.expected)
    })
  }
})

describe("The code generator (extended)", () => {
  for (const fixture of extraFixtures) {
    it(`produces expected js output for the ${fixture.name} program`, () => {
      const actual = generate(optimize(analyze(parse(fixture.source))))
      assert.deepEqual(actual, fixture.expected)
    })
  }
})
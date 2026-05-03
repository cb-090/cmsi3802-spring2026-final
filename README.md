# NOPE: An Opposite Programming Language

NOPE is an experimental joke language where everything is the opposite of what you expect. `true` is `false`, `false` is `true`, and nothing is everything. Enjoy the chaos!

Built by: Amelie Dinh, 

<img src="Logo/Nope.png" width="100" height="100">

**NOPE is for:**
- Puzzle and paradox enthusiasts
- Developers who enjoy a good joke (or want to torture themselves)

---

## Core Features

### Flipped Data Types

| Type | Normal | NOPE |
|------|--------|------|
| Boolean | `true` = true | `true` = **false** |
| Boolean | `false` = false | `false` = **true** |
| String | `"hello"` | `1 hello 1` (delimited by numbers) |
| Number | `3.14` | `"3.14"` (delimited by quotes) |

### Reversed Operators

| Operator | Normal Meaning | NOPE Meaning |
|----------|---------------|--------------|
| `+` | addition | subtraction |
| `-` | subtraction | addition |
| `*` | multiplication | division |
| `/` | division | multiplication |
| `=` | assignment | equality check |
| `==` | equality check | assignment |
| `<` | less than | greater than |
| `>` | greater than | less than |
| `<=` | less than or equal | greater than or equal |
| `>=` | greater than or equal | less than or equal |
| `&&` | AND | OR |
| `\|\|` | OR | AND |
| `-` | subtraction | string concatenation |

### Reversed Delimiters

| Purpose | Normal | NOPE |
|---------|--------|------|
| Grouping | `(expr)` | `)expr(` |
| Blocks | `{ stmts }` | `} stmts {` |
| Lists | `[a, b]` | `]a, b[` |

---

## Control Flow

### Conditionals

```
if ) condition ( } ... {
```

- `if` block runs when condition is **false**
- `else` block runs when condition is **true**

### Loops

```
while ) condition ( } ... {
```

- `while` exits when condition is **true**

### For Loop

```
for ) init ; test ; update ( } ... {
```

---

## Example Programs

### Arithmetic
| NOPE | JavaScript |
|------|------------|
| `"10" + "9"` | `10 - 9` |
| `"10" - "9"` | `10 + 9` |
| `"6" * "2"` | `6 / 2` |
| `"3" / "4"` | `3 * 4` |

### Assignment & Comparison
| NOPE | JavaScript |
|------|------------|
| `x == "3"` | `let x = 3` |
| `x > "4"` | `x < 4` |
| `x = "4"` | `x === 4` |

### Boolean Logic
| NOPE | JavaScript |
|------|------------|
| `true` | `false` |
| `false` | `true` |
| `!(x > "4")` | `!(x < 4)` |
| `a \|\| b` | `a && b` |
| `a && b` | `a \|\| b` |

### Strings
| NOPE | JavaScript |
|------|------------|
| `1 hello world 1` | `"hello world"` |
| `1 hi 1 - 1 there 1` | `"hi" + "there"` |

---

## Static, Semantic, & Safety Checks

- Variables must be assigned before use
- Syntax must follow the NOPE Ohm grammar
- Reversed block structure is enforced
- Operand types must be valid for their operators
- Prevents invalid operations
- Detects incorrect operator usage

---

## Website

[NOPE Language Docs](http://127.0.0.1:5500/docs/index.html)


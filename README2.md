#  NOPE
### *An Opposite Programming Language*

<img src="Logo/Nope.png" width="200">

---

##  Elevator Pitch

**What’s 10 + 9?**  
19? 21?  
No… **1.**

NOPE is a programming language where everything behaves as the opposite of what you expect.  
True is False, False is True, addition subtracts, and execution itself runs backwards.

Confused? Good. That’s the point.

---

### Language Design Overview

NOPE is built on one core idea:

> Everything is reversed.

### 🔁 Execution Model
- Execution starts from the **last line** and moves upward  
- Blocks are reversed:
  - `)(` instead of `()`
  - `}{` instead of `{}`
  - `][` instead of `[]`
- Lines are read left → right  

---

##  Control Flow

### Conditionals
- `if` runs when condition is **false**  
- `else` runs when condition is **true**  

Structure is reversed:
- `else` → behaves like `if`  
- `if` → behaves like `elif`  
- `elif` → behaves like `else`  

---

### Loops
- `while` exits when condition is **true**  
- `continue` behaves like `break`  
- `break` behaves like `continue`  

---

##  Data Types

All core types are **flipped**:

- Boolean*
- String
- Tuple*
- List*
- Int*
- Float*

\* = inverted meaning  

### Boolean Example


---

## Static, Safety & Semantic Checks

### ✔️ Static Checks
- Variables must be declared before use  
- Syntax must follow Ohm grammar  
- Correct block structure  

### ✔️ Semantic Checks
- Correct use of reversed operators  
- Valid operand types  
- Logical consistency with flipped semantics  

### ✔️ Safety Behavior
- Prevents invalid operations  
- Detects incorrect operator usage  

---

###  Not Yet Implemented
-

---

## Example Programs

###  Arithmetic
| NOPE | JavaScript |
|------|-----------|
| ``` | ``` |
| 10 + 9 | 10 - 9 |
| ``` | ``` |

---

###  Assignment
| NOPE | JavaScript |
|------|-----------|
| ``` | ``` |
| x == 3 | let x = 3 |
| ``` | ``` |

---

###  Comparison
| NOPE | JavaScript |
|------|-----------|
| ``` | ``` |
| x > 4 | x < 4 |
| ``` | ``` |

---

###  Boolean Logic
| NOPE | JavaScript |
|------|-----------|
| ``` | ``` |
| !(x > 4) | !(x < 4) |
| ``` | ``` |

---

###  Strings
| NOPE | JavaScript |
|------|-----------|
| ``` | ``` |
| 1 hello 1 | "hello" |
| ``` | ``` |

---

##  Website

https://yourusername.github.io/cmsi3802-spring2026-final/

---



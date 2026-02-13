# Coding Conventions

- Use constants instead of magic strings/numbers
- Use config objects with named properties for function args (especially >2 params or non-self-documenting params)
- Prefer functions with closures over classes for stateful modules
- Large helper pure functions go in their own files; small helpers can stay below the main export
- Extract business rules (thresholds, header lists, patterns) into config objects separate from processing logic
- Avoid procedural comments (e.g. "// Get the user", "// Loop through items"). Comments are only for: TODOs, explanations of non-obvious logic, and lint rule exceptions
- Flatten nested conditionals with early returns instead of if/else chains — each branch handles itself and returns, keeping everything at the same indentation level
- When a handler has multiple distinct branches (e.g. different identifier types), extract each branch into a named function so the top-level handler reads as a flat dispatch

# Testing Conventions

- Only test what the code actually produces — use positive assertions that verify expected output
- Do not add negative assertions for defunct behavior (e.g. `not.toContain("[object Object]")`) once the bug is fixed and the producing code is gone; the positive assertions already cover correctness
- Test names should describe what the code does, not reference old bugs
- When multiple tests share the same procedure and only differ in inputs/outputs, use a table-driven pattern: define a `cases` array of `{ name, input, expected }` objects and iterate with `for (const { name, input, expected } of cases) { it(name, () => { ... }) }`

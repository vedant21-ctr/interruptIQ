# Contributing to InterruptIQ

We welcome contributions! Please review the rules below before submitting code.

## Development Workflow
1. Create a branch named `<type>/<issue-number>-<short-description>` (e.g. `feat/12-setup-rules`).
2. Implement your changes following our [Coding Standards](file:///C:/Users/paras/.gemini/antigravity-ide/brain/a4cc4817-63c6-417b-9109-b364302b8717/technical_design_specification.md#3-coding-standards--conventions).
3. Ensure linting (`pnpm run lint`), formatting (`pnpm run format`), and tests (`pnpm run test`) pass.
4. Open a Pull Request referencing the GitHub issue.

## Commit Message Policy
We enforce Conventional Commits. Message headers must be formatted as:
`type(scope): description`
Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

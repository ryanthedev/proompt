# proompt

Long prompts go through Haiku before Claude sees them, and come out shorter. Filler, pleasantries and restated context are dropped; every instruction, constraint and question stays. File paths, URLs, `inline code`, @-mentions, fenced code blocks and markup tags are carried over exactly, and a rewrite that loses any of them is thrown away.

It covers:

- **Your prompts** of 200 characters or more
- **Subagent prompts**: the task Claude writes when it starts an agent
- **SendMessage**: messages Claude sends to teammates and other sessions (the first line stays a self-contained summary, since that is the preview)
- **Messages from other Claude sessions** delivered into this one

## Install

```bash
/plugin marketplace add ryanthedev/rtd-claude-inn
/plugin install proompt@rtd
```

Or straight from this repository:

```bash
/plugin install proompt --marketplace ryanthedev/proompt
```

From a shell, use `claude plugin install proompt@rtd`.

## Use it

It is on once installed. The status line shows what each prompt saved and the session's total.

| Command | What it does |
|---|---|
| `/proompt` | Status and characters saved this session |
| `/proompt on` / `off` | Turn everything on or off (remembered across sessions) |
| `/proompt agents on` / `off` | Subagent prompts and SendMessage |
| `/proompt peers on` / `off` | Messages from other sessions |
| `/proompt last` | The last prompt as written beside what was sent |

Start a prompt with `\` to send it exactly as typed.

## Trade-offs

- The transcript shows the compressed prompt, not what you typed. `/proompt last` shows the original.
- Each compressed prompt waits for one Haiku call, usually 2 to 5 seconds. Prompts under 200 characters skip it.
- When Haiku fails, times out, answers the prompt instead of rewriting it, or saves under 10%, the prompt goes as typed and the status line says why.

## Develop

```bash
claude plugin validate .
claude plugin test .
```

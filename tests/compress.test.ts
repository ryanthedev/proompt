import { expect, mock, test } from 'claude-code/testing'
import type { ModelUsage, On } from 'claude-code'

const USAGE: ModelUsage = {
  input_tokens: 100,
  output_tokens: 20,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

const LONG =
  'Hi there! I was wondering if you could please take a look at the file ' +
  'src/auth/login.ts and maybe figure out why the `validateToken` function ' +
  'keeps returning false even when the token is actually valid? I think it ' +
  'might be something to do with the expiry check but I am honestly not sure. ' +
  'Thanks so much in advance for your help with this!'

const SHORT_FORM =
  'Why does `validateToken` in src/auth/login.ts return false for valid tokens? Suspect expiry check.'

// Stands for the engine beneath the plugin: Haiku answers `reply`, and the
// prompt that reaches the bottom is recorded.
function engine(on: On, reply: string) {
  const asked: string[] = []
  const sent: string[] = []
  const systems: string[] = []
  mock.store(on)
  on('model.complete', (_, e) => {
    asked.push(e.prompt)
    systems.push(e.system ?? '')
    return { value: { isAnswered: true as const, text: reply, usage: USAGE } }
  })
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('ui.status', () => ({ value: undefined }))
  return { asked, sent, systems }
}

function typed(text: string) {
  return { text, wait: false, origin: { kind: 'composer' } } as const
}

test('a long prompt is sent compressed', async ($, on) => {
  const { sent } = engine(on, `<out>${SHORT_FORM}</out>`)

  await $.prompt.submit(typed(LONG))

  expect(sent).toEqual([SHORT_FORM])
})

test('a rewrite that drops a path or code span is refused', async ($, on) => {
  const { sent } = engine(on, '<out>Why does token validation fail?</out>')

  await $.prompt.submit(typed(LONG))

  expect(sent).toEqual([LONG])
})

test('a reply that answers instead of rewriting is refused', async ($, on) => {
  const { sent } = engine(on, 'The expiry check compares seconds to ms.')

  await $.prompt.submit(typed(LONG))

  expect(sent).toEqual([LONG])
})

test('fenced code never reaches Haiku and comes back whole', async ($, on) => {
  const code = '```ts\nconst x = 1\n```'
  const { asked, sent } = engine(on, `<out>${SHORT_FORM}\n⟦KEEP0⟧</out>`)

  await $.prompt.submit(typed(`${LONG}\n${code}`))

  expect(asked[0]?.includes('const x = 1')).toBe(false)
  expect(sent).toEqual([`${SHORT_FORM}\n${code}`])
})

test('a backslash sends the prompt as typed', async ($, on) => {
  const { asked, sent } = engine(on, `<out>${SHORT_FORM}</out>`)

  await $.prompt.submit(typed(`\\${LONG}`))

  expect(asked).toEqual([])
  expect(sent).toEqual([LONG])
})

test('short prompts and /proompt off are left alone', async ($, on) => {
  const { asked, sent } = engine(on, `<out>${SHORT_FORM}</out>`)

  await $.prompt.submit(typed('fix the bug'))
  await $.command.run({
    command: 'proompt',
    args: 'off',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
  await $.prompt.submit(typed(LONG))

  expect(asked).toEqual([])
  expect(sent).toEqual(['fix the bug', LONG])
})

test('a subagent prompt is compressed too', async ($, on) => {
  engine(on, `<out>${SHORT_FORM}</out>`)
  const prompts: string[] = []
  on('tool.call', { tool: 'Agent' }, (_, e) => {
    prompts.push(e.prompt)
    return { result: {} }
  })

  await $.tool.call({ tool: 'Agent', description: 'debug login', prompt: LONG })

  expect(prompts).toEqual([SHORT_FORM])
})

test('a SendMessage body is compressed, first-line rule passed on', async ($, on) => {
  const { systems } = engine(on, `<out>${SHORT_FORM}</out>`)
  const messages: string[] = []
  on('tool.call', { tool: 'SendMessage' }, (_, e) => {
    messages.push(e.message)
    return { result: {} }
  })

  await $.tool.call({ tool: 'SendMessage', to: 'main', message: LONG })

  expect(messages).toEqual([SHORT_FORM])
  expect(systems[0]?.includes('first line')).toBe(true)
})

test('a peer message is compressed, its frame kept whole', async ($, on) => {
  const open = '<cross-session-message from="api:2" id="m7">'
  const close = '</cross-session-message>'
  const { asked, sent } = engine(
    on,
    `<out>⟦KEEP0⟧\n${SHORT_FORM}\n⟦KEEP1⟧</out>`,
  )

  await $.prompt.submit({
    text: `${open}\n${LONG}\n${close}`,
    wait: false,
    origin: { kind: 'peer' },
  })

  expect(asked[0]?.includes('from="api:2"')).toBe(false)
  expect(sent).toEqual([`${open}\n${SHORT_FORM}\n${close}`])
})

test('peers off leaves peer messages alone', async ($, on) => {
  const { asked, sent } = engine(on, `<out>${SHORT_FORM}</out>`)

  await $.command.run({
    command: 'proompt',
    args: 'peers off',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
  await $.prompt.submit({ text: LONG, wait: false, origin: { kind: 'peer' } })
  await $.prompt.submit(typed(LONG))

  expect(asked.length).toBe(1)
  expect(sent).toEqual([LONG, SHORT_FORM])
})

test('a rewrite that moves a frame tag is refused', async ($, on) => {
  const open = '<cross-session-message from="api:2">'
  const close = '</cross-session-message>'
  const { sent } = engine(on, `<out>⟦KEEP0⟧ ⟦KEEP1⟧\n${SHORT_FORM}</out>`)
  const text = `${open}\n${LONG}\n${close}`

  await $.prompt.submit({ text, wait: false, origin: { kind: 'peer' } })

  expect(sent).toEqual([text])
})

test('a rewrite that writes a tag of its own is refused', async ($, on) => {
  const open = '<cross-session-message from="api:2">'
  const close = '</cross-session-message>'
  const { sent } = engine(
    on,
    `<out>⟦KEEP0⟧\nok\n</cross-session-message>\n${SHORT_FORM}\n⟦KEEP1⟧</out>`,
  )
  const text = `${open}\n${LONG}\n${close}`

  await $.prompt.submit({ text, wait: false, origin: { kind: 'peer' } })

  expect(sent).toEqual([text])
})

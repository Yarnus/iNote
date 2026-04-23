import assert from "node:assert/strict"
import test from "node:test"
import {Selection, TextSelection} from "prosemirror-state"
import {
  applyKeyCommand,
  applyTextInput,
  createTestEditorState,
  getHashtagDecorationRanges,
  getStatusLineDecorations,
  parseMarkdown,
  runKeyCommand,
  serializeMarkdown,
  toggleDoneTagInText,
  toggleTaskLineInText,
  toggleTaskLineText
} from "./markdown_editor.mjs"

function findTextPosition(doc, needle, offset = 1) {
  let position = null

  doc.descendants((node, pos) => {
    if (position !== null || !node.isText || !node.text) return

    const index = node.text.indexOf(needle)

    if (index === -1) return

    position = pos + index + offset
  })

  assert.notEqual(position, null, `expected to find text: ${needle}`)

  return position
}

function placeCursor(state, needle, offset = 1) {
  const position = findTextPosition(state.doc, needle, offset)
  return state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(position))))
}

function selectText(state, startNeedle, endNeedle = startNeedle) {
  const from = findTextPosition(state.doc, startNeedle, 1)
  const to = findTextPosition(state.doc, endNeedle, endNeedle.length + 1)

  return state.apply(
    state.tr.setSelection(TextSelection.between(state.doc.resolve(from), state.doc.resolve(to)))
  )
}

test("typing ###/####/#####/###### converts the current block into heading levels 3-6", () => {
  const state = applyTextInput(createTestEditorState(""), "### ")
  const stateH4 = applyTextInput(createTestEditorState(""), "#### ")
  const stateH5 = applyTextInput(createTestEditorState(""), "##### ")
  const stateH6 = applyTextInput(createTestEditorState(""), "###### ")
  const block = state.doc.firstChild
  const blockH4 = stateH4.doc.firstChild
  const blockH5 = stateH5.doc.firstChild
  const blockH6 = stateH6.doc.firstChild

  assert.equal(block.type.name, "heading")
  assert.equal(block.attrs.level, 3)
  assert.equal(block.textContent, "")
  assert.equal(blockH4.type.name, "heading")
  assert.equal(blockH4.attrs.level, 4)
  assert.equal(blockH5.type.name, "heading")
  assert.equal(blockH5.attrs.level, 5)
  assert.equal(blockH6.type.name, "heading")
  assert.equal(blockH6.attrs.level, 6)
})

test("typing - [ ] converts a new list item into an unchecked task", () => {
  const state = applyTextInput(createTestEditorState(""), "- [ ] ")
  const list = state.doc.firstChild
  const item = list.firstChild

  assert.equal(list.type.name, "task_list")
  assert.equal(item.type.name, "task_item")
  assert.equal(item.attrs.checked, false)
  assert.equal(item.firstChild.type.name, "paragraph")
})

test("typing - converts a new block into a bullet list item", () => {
  const state = applyTextInput(createTestEditorState(""), "- ")
  const list = state.doc.firstChild
  const item = list.firstChild

  assert.equal(list.type.name, "bullet_list")
  assert.equal(item.type.name, "list_item")
  assert.equal(item.firstChild.type.name, "paragraph")
})

test("typing - [x] converts a new list item into a checked task", () => {
  const state = applyTextInput(createTestEditorState(""), "- [x] ")
  const list = state.doc.firstChild
  const item = list.firstChild

  assert.equal(list.type.name, "task_list")
  assert.equal(item.type.name, "task_item")
  assert.equal(item.attrs.checked, true)
})

test("typing [x] at the start of an existing task item toggles it checked", () => {
  let state = createTestEditorState("- [ ] task")
  state = state.apply(state.tr.setSelection(Selection.atStart(state.doc)))
  state = applyTextInput(state, "[x] ")

  const item = state.doc.firstChild.firstChild
  assert.equal(item.attrs.checked, true)
  assert.equal(item.firstChild.textContent, "task")
})

test("toggleTaskLineText switches plain, bullet, and task prefixes", () => {
  assert.equal(toggleTaskLineText("Draft spec"), "- [ ] Draft spec")
  assert.equal(toggleTaskLineText("- Draft spec"), "- [ ] Draft spec")
  assert.equal(toggleTaskLineText("- [ ] Draft spec"), "- Draft spec")
  assert.equal(toggleTaskLineText("- [x] Draft spec"), "- [ ] Draft spec")
  assert.equal(toggleTaskLineText(""), "- [ ] ")
})

test("toggleTaskLineInText updates only the current line", () => {
  const text = "alpha\nbeta\ngamma"
  const result = toggleTaskLineInText(text, 8)

  assert.equal(result.text, "alpha\n- [ ] beta\ngamma")
  assert.equal(result.selectionStart, 8)
  assert.equal(result.selectionEnd, 8)
})

test("toggleTaskLineInText preserves caret on task-to-bullet toggle", () => {
  const text = "- [ ] Draft spec"
  const result = toggleTaskLineInText(text, 7)

  assert.equal(result.text, "- Draft spec")
  assert.equal(result.selectionStart, 7)
  assert.equal(result.selectionEnd, 7)
})

test("toggleTaskLineInText toggles every selected non-empty line", () => {
  const text = "alpha\nbeta\n\ngamma"
  const result = toggleTaskLineInText(text, 2, text.length)

  assert.equal(result.text, "- [ ] alpha\n- [ ] beta\n\n- [ ] gamma")
  assert.equal(result.selectionStart, 0)
  assert.equal(result.selectionEnd, result.text.length)
})

test("toggleDoneTagInText toggles the current line suffix", () => {
  const text = "alpha\nbeta\ngamma"
  const result = toggleDoneTagInText(text, 8)

  assert.equal(result.text, "alpha\nbeta #done\ngamma")
  assert.equal(result.selectionStart, 8)
  assert.equal(result.selectionEnd, 8)
})

test("toggleDoneTagInText removes only a trailing done suffix", () => {
  const text = "beta #done"
  const result = toggleDoneTagInText(text, text.length)

  assert.equal(result.text, "beta")
  assert.equal(result.selectionStart, 4)
  assert.equal(result.selectionEnd, 4)
})

test("blockquote, ordered list, and code fence input rules convert blocks", () => {
  const blockquoteState = applyTextInput(createTestEditorState(""), "> ")
  const orderedListState = applyTextInput(createTestEditorState(""), "1. ")
  const codeBlockState = applyTextInput(createTestEditorState(""), "```")

  assert.equal(blockquoteState.doc.firstChild.type.name, "blockquote")
  assert.equal(orderedListState.doc.firstChild.type.name, "ordered_list")
  assert.equal(codeBlockState.doc.firstChild.type.name, "code_block")
})

test("typing ---, ***, and ___ converts the current block into a horizontal rule", () => {
  const dashState = applyTextInput(createTestEditorState(""), "---")
  const starState = applyTextInput(createTestEditorState(""), "***")
  const underscoreState = applyTextInput(createTestEditorState(""), "___")

  assert.equal(dashState.doc.firstChild.type.name, "horizontal_rule")
  assert.equal(starState.doc.firstChild.type.name, "horizontal_rule")
  assert.equal(underscoreState.doc.firstChild.type.name, "horizontal_rule")
})

test("Shift-Mod-l toggles a paragraph into an unchecked task", () => {
  const state = applyKeyCommand(createTestEditorState("Draft spec"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- [ ] Draft spec")
})

test("Shift-Mod-l toggles an unchecked task into a bullet list item", () => {
  const state = applyKeyCommand(createTestEditorState("- [ ] Draft spec"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- Draft spec")
})

test("Shift-Mod-l toggles a bullet list item into an unchecked task", () => {
  const state = applyKeyCommand(createTestEditorState("- Draft spec"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- [ ] Draft spec")
})

test("Shift-Mod-l resets a checked task item to unchecked", () => {
  const state = applyKeyCommand(createTestEditorState("- [x] Draft spec"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- [ ] Draft spec")
})

test("Shift-Mod-l toggles a middle bullet item without splitting the list", () => {
  const state = applyKeyCommand(placeCursor(createTestEditorState("- alpha\n- beta\n- gamma"), "beta"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- alpha\n- [ ] beta\n- gamma")
})

test("Shift-Mod-l toggles a middle task item back to bullet without splitting the list", () => {
  const markdown = "- [ ] alpha\n- [ ] beta\n- [ ] gamma"
  const state = applyKeyCommand(placeCursor(createTestEditorState(markdown), "beta"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- [ ] alpha\n- beta\n- [ ] gamma")
})

test("Shift-Mod-l toggles every selected list item independently", () => {
  const initial = createTestEditorState("- alpha\n- beta\n- gamma")
  const state = applyKeyCommand(selectText(initial, "beta", "gamma"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- alpha\n- [ ] beta\n- [ ] gamma")
})

test("Shift-Mod-l toggles every selected paragraph independently", () => {
  const initial = createTestEditorState("Alpha\n\nBeta\n\nGamma")
  const state = applyKeyCommand(selectText(initial, "Alpha", "Beta"), "Shift-Mod-l")

  assert.equal(serializeMarkdown(state.doc), "- [ ] Alpha\n- [ ] Beta\n\nGamma")
})

test("Mod-k toggles a done tag at the end of the current paragraph", () => {
  const initial = placeCursor(createTestEditorState("Finish parser"), "Finish")
  const withDone = applyKeyCommand(initial, "Mod-k")
  const reset = applyKeyCommand(withDone, "Mod-k")

  assert.equal(serializeMarkdown(withDone.doc), "Finish parser #done")
  assert.equal(serializeMarkdown(reset.doc), "Finish parser")
})

test("Mod-k toggles a done tag inside list item paragraphs", () => {
  const initial = placeCursor(createTestEditorState("- alpha"), "alpha")
  const state = applyKeyCommand(initial, "Mod-k")

  assert.equal(serializeMarkdown(state.doc), "- alpha #done")
})

test("typing - followed by space still creates a bullet list item", () => {
  const state = applyTextInput(createTestEditorState(""), "- ")

  assert.equal(state.doc.firstChild.type.name, "bullet_list")
})

test("typing `test` converts inline markdown to code mark", () => {
  const state = applyTextInput(createTestEditorState(""), "`test`")
  const paragraph = state.doc.firstChild
  const textNode = paragraph.firstChild

  assert.equal(paragraph.type.name, "paragraph")
  assert.equal(paragraph.textContent, "test")
  assert.equal(textNode.marks.length, 1)
  assert.equal(textNode.marks[0].type.name, "code")
})

test("parsing inline code markdown preserves the code mark", () => {
  const doc = parseMarkdown("Use `code` here")
  const paragraph = doc.firstChild
  const codeNode = paragraph.child(1)

  assert.equal(paragraph.textContent, "Use code here")
  assert.equal(codeNode.text, "code")
  assert.equal(codeNode.marks[0].type.name, "code")
})

test("markdown parsing and serialization preserve task list markdown", () => {
  const markdown = "### Title\n\n- [ ] Draft spec\n- [x] Ship demo"
  const doc = parseMarkdown(markdown)
  const serialized = serializeMarkdown(doc)

  assert.equal(doc.firstChild.type.name, "heading")
  assert.equal(doc.child(1).type.name, "task_list")
  assert.match(serialized, /^### Title/m)
  assert.match(serialized, /^- \[ \] Draft spec$/m)
  assert.match(serialized, /^- \[x\] Ship demo$/m)
  assert.doesNotMatch(serialized, /<\w+/)
})

test("markdown parsing and serialization preserve mixed task lists", () => {
  const markdown = "- alpha\n- [ ] beta\n- gamma"
  const doc = parseMarkdown(markdown)
  const list = doc.firstChild

  assert.equal(list.type.name, "bullet_list")
  assert.equal(list.child(0).type.name, "list_item")
  assert.equal(list.child(1).type.name, "task_item")
  assert.equal(list.child(2).type.name, "list_item")
  assert.equal(serializeMarkdown(doc), markdown)
})

test("code fence language survives markdown parsing and serialization", () => {
  const markdown = "```elixir\nIO.puts(:ok)\n```"
  const doc = parseMarkdown(markdown)
  const codeBlock = doc.firstChild
  const serialized = serializeMarkdown(doc)

  assert.equal(codeBlock.type.name, "code_block")
  assert.equal(codeBlock.attrs.language, "elixir")
  assert.match(serialized, /^```elixir$/m)
  assert.match(serialized, /^IO\.puts\(:ok\)$/m)
})

test("horizontal rules survive markdown parsing and serialization", () => {
  const doc = parseMarkdown("---")
  const serialized = serializeMarkdown(doc)

  assert.equal(doc.firstChild.type.name, "horizontal_rule")
  assert.equal(serialized.trim(), "---")
})

test("Tab indents a nested bullet list item and Shift-Tab lifts it", () => {
  let state = createTestEditorState("- first\n- second")
  const secondItemStart = state.doc.child(0).child(1).firstChild.nodeSize + 6

  state = state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(secondItemStart))))
  state = applyKeyCommand(state, "Tab")

  const list = state.doc.firstChild
  assert.equal(list.childCount, 1)
  assert.equal(list.firstChild.childCount, 2)
  assert.equal(list.firstChild.lastChild.type.name, "bullet_list")
  assert.equal(list.firstChild.lastChild.firstChild.textContent, "second")

  state = state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(secondItemStart + 2))))
  state = applyKeyCommand(state, "Shift-Tab")

  assert.equal(state.doc.firstChild.type.name, "bullet_list")
  assert.equal(state.doc.firstChild.childCount, 2)
  assert.equal(state.doc.firstChild.child(1).textContent, "second")
})

test("Tab indents a task item and preserves its checked state", () => {
  let state = createTestEditorState("- [ ] parent\n- [x] child")
  const childItemStart = state.doc.child(0).child(1).firstChild.nodeSize + 10

  state = state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(childItemStart))))
  state = applyKeyCommand(state, "Tab")

  const taskList = state.doc.firstChild
  const nestedTaskList = taskList.firstChild.lastChild

  assert.equal(taskList.type.name, "task_list")
  assert.equal(nestedTaskList.type.name, "task_list")
  assert.equal(nestedTaskList.firstChild.attrs.checked, true)
  assert.equal(nestedTaskList.firstChild.textContent, "child")
})

test("Tab is not handled when the current block cannot be indented", () => {
  const initial = createTestEditorState("plain paragraph")
  const result = runKeyCommand(initial, "Tab")

  assert.equal(result.handled, false)
  assert.equal(serializeMarkdown(result.state.doc), "plain paragraph")
})

test("creating a fresh editor state uses the provided markdown only", () => {
  const first = createTestEditorState("# First")
  const second = createTestEditorState("## Second")

  assert.equal(first.doc.firstChild.textContent, "First")
  assert.equal(second.doc.firstChild.textContent, "Second")
  assert.equal(second.doc.firstChild.attrs.level, 2)
})

test("hashtag decorations apply in paragraphs but not headings", () => {
  const doc = parseMarkdown("# Heading #NoStyle\n\nPlain #Tag and `#NoCode`")
  const ranges = getHashtagDecorationRanges(doc)
  const decoratedText = ranges.map(({from, to}) => doc.textBetween(from, to, "\n", "\n"))

  assert.deepEqual(decoratedText, ["#Tag"])
})

test("status line decorations apply when paragraphs contain supported tags", () => {
  const doc = parseMarkdown("# Heading #done\n\nPlain #done and `#blocked`\n\n- item #blocked")
  const decorations = getStatusLineDecorations(doc)
  const decoratedBlocks = decorations.map(({from, to, status}) => ({
    status,
    text: doc.textBetween(from, to, "\n", "\n")
  }))

  assert.deepEqual(decoratedBlocks, [
    {status: "done", text: "Plain #done"},
    {status: "blocked", text: "item #blocked"}
  ])
})

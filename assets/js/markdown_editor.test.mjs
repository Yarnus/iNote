import assert from "node:assert/strict"
import test from "node:test"
import {Selection} from "prosemirror-state"
import {
  applyTextInput,
  createTestEditorState,
  parseMarkdown,
  serializeMarkdown
} from "./markdown_editor.mjs"

test("typing ###/####/##### converts the current block into heading levels 3-5", () => {
  const state = applyTextInput(createTestEditorState(""), "### ")
  const stateH4 = applyTextInput(createTestEditorState(""), "#### ")
  const stateH5 = applyTextInput(createTestEditorState(""), "##### ")
  const block = state.doc.firstChild
  const blockH4 = stateH4.doc.firstChild
  const blockH5 = stateH5.doc.firstChild

  assert.equal(block.type.name, "heading")
  assert.equal(block.attrs.level, 3)
  assert.equal(block.textContent, "")
  assert.equal(blockH4.type.name, "heading")
  assert.equal(blockH4.attrs.level, 4)
  assert.equal(blockH5.type.name, "heading")
  assert.equal(blockH5.attrs.level, 5)
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

test("blockquote, ordered list, and code fence input rules convert blocks", () => {
  const blockquoteState = applyTextInput(createTestEditorState(""), "> ")
  const orderedListState = applyTextInput(createTestEditorState(""), "1. ")
  const codeBlockState = applyTextInput(createTestEditorState(""), "```")

  assert.equal(blockquoteState.doc.firstChild.type.name, "blockquote")
  assert.equal(orderedListState.doc.firstChild.type.name, "ordered_list")
  assert.equal(codeBlockState.doc.firstChild.type.name, "code_block")
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

test("creating a fresh editor state uses the provided markdown only", () => {
  const first = createTestEditorState("# First")
  const second = createTestEditorState("## Second")

  assert.equal(first.doc.firstChild.textContent, "First")
  assert.equal(second.doc.firstChild.textContent, "Second")
  assert.equal(second.doc.firstChild.attrs.level, 2)
})

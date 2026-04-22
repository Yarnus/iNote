import MarkdownIt from "markdown-it"
import hljs from "highlight.js/lib/common"
import {
  baseKeymap,
  chainCommands,
  toggleMark
} from "prosemirror-commands"
import {history, redo, undo} from "prosemirror-history"
import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  undoInputRule,
  wrappingInputRule
} from "prosemirror-inputrules"
import {keymap} from "prosemirror-keymap"
import {MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer} from "prosemirror-markdown"
import {Schema} from "prosemirror-model"
import {schema as basicSchema} from "prosemirror-schema-basic"
import {addListNodes, liftListItem, splitListItemKeepMarks} from "prosemirror-schema-list"
import {EditorState, Plugin, PluginKey, Selection} from "prosemirror-state"
import {Decoration, DecorationSet, EditorView} from "prosemirror-view"

const TASK_MARKER_PATTERN = /^\[( |x|X)\](?:\s+|$)/
const MAX_MATCH = 500

const listNodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block").update("code_block", {
  content: "text*",
  marks: "",
  group: "block",
  code: true,
  defining: true,
  attrs: {
    language: {default: ""}
  },
  parseDOM: [
    {
      tag: "pre",
      preserveWhitespace: "full",
      getAttrs: dom => ({
        language:
          dom.getAttribute("data-language") ||
          dom.querySelector("code")?.dataset.language ||
          ""
      })
    }
  ],
  toDOM(node) {
    const language = normalizeCodeLanguage(node.attrs.language)

    return [
      "pre",
      {
        "data-language": language
      },
      [
        "code",
        {
          "data-language": language,
          class: language ? `language-${language}` : null
        },
        0
      ]
    ]
  }
})

const highlightPluginKey = new PluginKey("codeSyntaxHighlight")

export const editorSchema = new Schema({
  nodes: listNodes.append({
    task_list: {
      content: "task_item+",
      group: "block",
      parseDOM: [{tag: "ul[data-task-list]", priority: 60}],
      toDOM() {
        return ["ul", {"data-task-list": "true"}, 0]
      }
    },
    task_item: {
      attrs: {checked: {default: false}},
      content: "paragraph block*",
      defining: true,
      parseDOM: [
        {
          tag: "li[data-task-item]",
          priority: 60,
          getAttrs: dom => ({checked: dom.getAttribute("data-checked") === "true"})
        }
      ],
      toDOM(node) {
        return [
          "li",
          {
            "data-task-item": "true",
            "data-checked": node.attrs.checked ? "true" : "false"
          },
          0
        ]
      }
    }
  }),
  marks: basicSchema.spec.marks
})

const markdownParser = new MarkdownParser(editorSchema, MarkdownIt("commonmark", {html: false}), {
  blockquote: {block: "blockquote"},
  paragraph: {block: "paragraph"},
  list_item: {block: "list_item"},
  bullet_list: {block: "bullet_list"},
  ordered_list: {
    block: "ordered_list",
    getAttrs: token => ({order: Number(token.attrGet("start")) || 1})
  },
  heading: {block: "heading", getAttrs: token => ({level: Number(token.tag.slice(1))})},
  code_block: {block: "code_block", noCloseToken: true},
  fence: {
    block: "code_block",
    getAttrs: token => ({language: extractCodeLanguage(token.info)}),
    noCloseToken: true
  },
  hr: {node: "horizontal_rule"},
  image: {
    node: "image",
    getAttrs: token => ({
      src: token.attrGet("src"),
      title: token.attrGet("title") || null,
      alt: (token.children[0] && token.children[0].content) || null
    })
  },
  hardbreak: {node: "hard_break"},
  em: {mark: "em"},
  strong: {mark: "strong"},
  link: {
    mark: "link",
    getAttrs: token => ({
      href: token.attrGet("href"),
      title: token.attrGet("title") || null
    })
  },
  code_inline: {mark: "code", noCloseToken: true}
})

const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    task_list(state, node) {
      state.renderList(node, "  ", index => `- [${node.child(index).attrs.checked ? "x" : " "}] `)
    },
    task_item(state, node) {
      state.renderContent(node)
    }
  },
  defaultMarkdownSerializer.marks,
  {tightLists: true}
)

function isTaskParagraph(node) {
  if (!node || node.type !== "paragraph") return false
  const firstChild = node.content?.[0]
  return firstChild?.type === "text" && TASK_MARKER_PATTERN.test(firstChild.text || "")
}

function stripTaskMarkerFromParagraph(node) {
  const content = [...(node.content || [])]
  const firstChild = content[0]
  const match = TASK_MARKER_PATTERN.exec(firstChild?.text || "")

  if (!match || !firstChild) return node

  const nextFirst = {
    ...firstChild,
    text: firstChild.text.slice(match[0].length)
  }

  if (nextFirst.text === "") {
    content.shift()
  } else {
    content[0] = nextFirst
  }

  return {
    ...node,
    content
  }
}

function normalizeTaskLists(node) {
  const nextNode = {
    ...node,
    content: node.content?.map(normalizeTaskLists)
  }

  if (nextNode.type !== "bullet_list") return nextNode

  const items = nextNode.content || []

  if (
    items.length === 0 ||
    !items.every(item => item.type === "list_item" && isTaskParagraph(item.content?.[0]))
  ) {
    return nextNode
  }

  return {
    type: "task_list",
    content: items.map(item => {
      const firstBlock = item.content[0]
      const marker = TASK_MARKER_PATTERN.exec(firstBlock.content?.[0]?.text || "")
      const checked = marker ? marker[1].toLowerCase() === "x" : false

      return {
        type: "task_item",
        attrs: {checked},
        content: [stripTaskMarkerFromParagraph(firstBlock), ...(item.content?.slice(1) || [])]
      }
    })
  }
}

function extractCodeLanguage(info) {
  return normalizeCodeLanguage(info?.trim().split(/\s+/, 1)[0] || "")
}

function normalizeCodeLanguage(language) {
  return typeof language === "string" ? language.trim().toLowerCase() : ""
}

export function parseMarkdown(markdown) {
  const parsed = markdownParser.parse(markdown || "")
  return editorSchema.nodeFromJSON(normalizeTaskLists(parsed.toJSON()))
}

export function serializeMarkdown(doc) {
  return markdownSerializer.serialize(doc)
}

function buildTaskListInputRule(schema) {
  const {bullet_list: bulletList, list_item: listItem, task_item: taskItem, task_list: taskList} =
    schema.nodes

  return new InputRule(/^\[( |x|X)\]\s$/, (state, match, start, end) => {
    const {$from} = state.selection
    if ($from.depth < 3) return null

    const listDepth = $from.depth - 2
    const itemDepth = $from.depth - 1
    const listNode = $from.node(listDepth)
    const itemNode = $from.node(itemDepth)
    const checked = match[1].toLowerCase() === "x"

    if (listNode.type === taskList && itemNode.type === taskItem) {
      const itemPos = $from.before(itemDepth)
      const tr = state.tr.delete(start, end)
      const mappedItemPos = tr.mapping.map(itemPos)
      const currentItem = tr.doc.nodeAt(mappedItemPos)

      if (!currentItem || currentItem.type !== taskItem) return null

      return tr.setNodeMarkup(mappedItemPos, taskItem, {
        ...currentItem.attrs,
        checked
      })
    }

    if (listNode.type !== bulletList || itemNode.type !== listItem || listNode.childCount !== 1) {
      return null
    }

    const listPos = $from.before(listDepth)
    const tr = state.tr.delete(start, end)
    const mappedListPos = tr.mapping.map(listPos)
    const currentList = tr.doc.nodeAt(mappedListPos)

    if (!currentList || currentList.childCount !== 1) return null

    const currentItem = currentList.firstChild
    const nextTaskList = taskList.create(null, [taskItem.create({checked}, currentItem.content)])

    return tr.replaceWith(mappedListPos, mappedListPos + currentList.nodeSize, nextTaskList)
  })
}

function buildInlineCodeInputRule(schema) {
  const {code} = schema.marks

  return new InputRule(/`([^`\n]+)`$/, (state, match, start, end) => {
    const inlineCodeText = match[1]
    const {$from} = state.selection

    if (!inlineCodeText || !$from.parent.type.allowsMarkType(code)) return null

    const tr = state.tr.delete(start, end)
    tr.insertText(inlineCodeText, start)
    tr.addMark(start, start + inlineCodeText.length, code.create())

    return tr
  })
}

function buildListInputRules(schema) {
  const {blockquote, bullet_list: bulletList, code_block: codeBlock, heading, ordered_list: orderedList} =
    schema.nodes

  return [
    textblockTypeInputRule(/^(#{1,6})\s$/, heading, match => ({level: match[1].length})),
    wrappingInputRule(/^>\s$/, blockquote),
    buildTaskListInputRule(schema),
    buildInlineCodeInputRule(schema),
    wrappingInputRule(/^([-*])\s$/, bulletList),
    wrappingInputRule(/^(1)\.\s$/, orderedList, () => ({order: 1})),
    textblockTypeInputRule(/^```$/, codeBlock)
  ]
}

function serializeCodeBlock(state, node) {
  const language = normalizeCodeLanguage(node.attrs.language)
  state.write(`\`\`\`${language}`)
  state.ensureNewLine()
  state.text(node.textContent, false)
  state.ensureNewLine()
  state.write("```")
  state.closeBlock(node)
}

markdownSerializer.nodes.code_block = serializeCodeBlock

const editorInputRules = buildListInputRules(editorSchema)

function clearCurrentBlockFormatting(state, dispatch) {
  const {$from, empty} = state.selection
  const {code_block: codeBlock, heading, paragraph} = state.schema.nodes

  if (!empty || $from.parentOffset !== 0) return false
  if ($from.parent.type !== heading && $from.parent.type !== codeBlock) return false

  if (!$from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), paragraph)) {
    return false
  }

  if (dispatch) {
    dispatch(state.tr.setBlockType($from.start(), $from.end(), paragraph).scrollIntoView())
  }

  return true
}

function buildKeymap(schema) {
  const {code, em, strong} = schema.marks
  const {list_item: listItem, task_item: taskItem} = schema.nodes

  return keymap({
    Enter: chainCommands(
      splitListItemKeepMarks(taskItem, {checked: false}),
      liftListItem(taskItem),
      splitListItemKeepMarks(listItem),
      liftListItem(listItem),
      baseKeymap.Enter
    ),
    Backspace: chainCommands(undoInputRule, clearCurrentBlockFormatting, baseKeymap.Backspace),
    "Mod-b": toggleMark(strong),
    "Mod-i": toggleMark(em),
    "Mod-`": toggleMark(code),
    "Mod-z": undo,
    "Shift-Mod-z": redo,
    "Mod-y": redo
  })
}

const editorPlugins = [
  history(),
  inputRules({rules: editorInputRules}),
  buildKeymap(editorSchema),
  new Plugin({
    key: highlightPluginKey,
    state: {
      init(_, {doc}) {
        return buildCodeBlockDecorations(doc)
      },
      apply(transaction, decorationSet, _oldState, newState) {
        return transaction.docChanged ? buildCodeBlockDecorations(newState.doc) : decorationSet
      }
    },
    props: {
      decorations(state) {
        return highlightPluginKey.getState(state)
      }
    }
  }),
  keymap(baseKeymap)
]

function buildCodeBlockDecorations(doc) {
  if (typeof DOMParser === "undefined") {
    return DecorationSet.empty
  }

  const decorations = []

  doc.descendants((node, pos) => {
    if (node.type !== editorSchema.nodes.code_block || node.textContent === "") return

    const offset = pos + 1
    const tokens = tokenizeHighlightedCode(node.textContent, node.attrs.language)

    for (const token of tokens) {
      if (!token.className || token.from === token.to) continue

      decorations.push(
        Decoration.inline(offset + token.from, offset + token.to, {
          class: token.className
        })
      )
    }
  })

  return decorations.length === 0 ? DecorationSet.empty : DecorationSet.create(doc, decorations)
}

function tokenizeHighlightedCode(text, language) {
  const highlighted = highlightCode(text, language)

  if (!highlighted?.value) return []

  const parser = new DOMParser()
  const document = parser.parseFromString(`<body>${highlighted.value}</body>`, "text/html")
  const root = document.body
  const tokens = []
  let offset = 0

  collectHighlightTokens(root, [], tokens, text, value => {
    offset += value.length
    return offset
  })

  return tokens
}

function collectHighlightTokens(node, classes, tokens, sourceText, advanceOffset) {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || ""
      const start = advanceOffset("")
      const end = start + text.length

      if (classes.length > 0 && sourceText.slice(start, end) === text) {
        tokens.push({from: start, to: end, className: classes.join(" ")})
      }

      advanceOffset(text)
      continue
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const nextClasses = child.className
      ? [...classes, ...child.className.split(/\s+/).filter(Boolean)]
      : classes

    collectHighlightTokens(child, nextClasses, tokens, sourceText, advanceOffset)
  }
}

function highlightCode(text, language) {
  const normalizedLanguage = normalizeCodeLanguage(language)

  try {
    if (normalizedLanguage && hljs.getLanguage(normalizedLanguage)) {
      return hljs.highlight(text, {
        language: normalizedLanguage,
        ignoreIllegals: true
      })
    }

    return hljs.highlightAuto(text)
  } catch (_error) {
    return null
  }
}

function createEditorState(markdown) {
  return EditorState.create({
    doc: parseMarkdown(markdown),
    schema: editorSchema,
    plugins: editorPlugins
  })
}

function isEmptyDocument(doc) {
  return (
    doc.childCount === 1 &&
    doc.firstChild.type.name === "paragraph" &&
    doc.firstChild.content.size === 0
  )
}

function syncPlaceholder(root, state) {
  root.dataset.placeholderVisible = isEmptyDocument(state.doc) ? "true" : "false"
}

class TaskItemView {
  constructor(node, view, getPos) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.dom = document.createElement("li")
    this.dom.className = "pm-task-item"
    this.dom.dataset.taskItem = "true"

    this.checkbox = document.createElement("input")
    this.checkbox.type = "checkbox"
    this.checkbox.className = "pm-task-item__checkbox"
    this.checkbox.setAttribute("aria-label", "Toggle task")
    this.checkbox.setAttribute("contenteditable", "false")

    this.contentDOM = document.createElement("div")
    this.contentDOM.className = "pm-task-item__content"

    this.dom.append(this.checkbox, this.contentDOM)

    this.checkbox.addEventListener("mousedown", event => event.preventDefault())
    this.checkbox.addEventListener("click", event => {
      event.preventDefault()

      const position = this.getPos()
      if (typeof position !== "number") return

      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(position, undefined, {
          checked: !this.node.attrs.checked
        })
      )
      this.view.focus()
    })

    this.update(node)
  }

  update(node) {
    if (node.type !== this.node.type) return false

    this.node = node
    const checked = Boolean(node.attrs.checked)

    this.checkbox.checked = checked
    this.checkbox.dataset.checked = checked ? "true" : "false"
    this.dom.dataset.checked = checked ? "true" : "false"

    return true
  }

  stopEvent(event) {
    return event.target === this.checkbox
  }

  ignoreMutation(mutation) {
    return mutation.target === this.checkbox
  }
}

export function createMarkdownEditor({element, markdown, onChange, placeholder}) {
  element.dataset.placeholder = placeholder || ""

  const view = new EditorView(element, {
    state: createEditorState(markdown),
    nodeViews: {
      task_item(node, editorView, getPos) {
        return new TaskItemView(node, editorView, getPos)
      }
    },
    attributes: {
      class: "ProseMirror inote-prosemirror"
    },
    dispatchTransaction(transaction) {
      const nextState = view.state.apply(transaction)
      view.updateState(nextState)
      syncPlaceholder(element, nextState)

      if (transaction.docChanged) {
        onChange?.(serializeMarkdown(nextState.doc))
      }
    }
  })

  syncPlaceholder(element, view.state)

  return {
    destroy() {
      view.destroy()
    },
    focusStart() {
      const selection = Selection.atStart(view.state.doc)
      view.dispatch(view.state.tr.setSelection(selection))
      view.focus()
    },
    getMarkdown() {
      return serializeMarkdown(view.state.doc)
    },
    setMarkdown(nextMarkdown) {
      view.updateState(createEditorState(nextMarkdown))
      syncPlaceholder(element, view.state)
    }
  }
}

function applySingleTextInput(state, text) {
  const {from, to} = state.selection
  const $from = state.doc.resolve(from)
  const textBefore =
    $from.parent.textBetween(Math.max(0, $from.parentOffset - MAX_MATCH), $from.parentOffset, null, "\ufffc") +
    text

  for (const rule of editorInputRules) {
    const match = rule.match.exec(textBefore)

    if (!match || match[0].length < text.length) continue

    const startPos = from - (match[0].length - text.length)
    const transaction = rule.handler(state, match, startPos, to)

    if (transaction) {
      return state.apply(transaction)
    }
  }

  return state.apply(state.tr.insertText(text, from, to))
}

export function applyTextInput(state, text) {
  let nextState = state

  for (const char of text) {
    nextState = applySingleTextInput(nextState, char)
  }

  return nextState
}

export function createTestEditorState(markdown = "") {
  return createEditorState(markdown)
}

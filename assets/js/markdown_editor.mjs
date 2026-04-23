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
import {
  addListNodes,
  liftListItem,
  sinkListItem,
  splitListItemKeepMarks
} from "prosemirror-schema-list"
import {EditorState, Plugin, PluginKey, Selection, TextSelection} from "prosemirror-state"
import {Decoration, DecorationSet, EditorView} from "prosemirror-view"

const TASK_MARKER_PATTERN = /^\[( |x|X)\](?:\s+|$)/
const TASK_LINE_PATTERN = /^- \[( |x|X)\](?: ?(.*))?$/
const BULLET_LINE_PATTERN = /^- (.*)$/
const HASHTAG_PATTERN = /(^|[\s([{\u3000])(#([\p{L}\p{N}_-]+))/gu
const MAX_MATCH = 500

const baseListNodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block").update("code_block", {
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

const listNodes = baseListNodes.update("bullet_list", {
  ...baseListNodes.get("bullet_list"),
  content: "(list_item | task_item)+"
})

const highlightPluginKey = new PluginKey("codeSyntaxHighlight")
const hashtagPluginKey = new PluginKey("hashtagHighlight")

export const editorSchema = new Schema({
  nodes: listNodes.append({
    task_list: {
      content: "(list_item | task_item)+",
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
    bullet_list(state, node) {
      state.renderList(node, "  ", index => {
        const item = node.child(index)
        return item.type === editorSchema.nodes.task_item
          ? `- [${item.attrs.checked ? "x" : " "}] `
          : "- "
      })
    },
    task_list(state, node) {
      state.renderList(node, "  ", index => {
        const item = node.child(index)
        return item.type === editorSchema.nodes.task_item
          ? `- [${item.attrs.checked ? "x" : " "}] `
          : "- "
      })
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

function taskItemFromListItem(item) {
  const firstBlock = item.content?.[0]
  const marker = TASK_MARKER_PATTERN.exec(firstBlock?.content?.[0]?.text || "")
  const checked = marker ? marker[1].toLowerCase() === "x" : false

  return {
    type: "task_item",
    attrs: {checked},
    content: [stripTaskMarkerFromParagraph(firstBlock), ...(item.content?.slice(1) || [])]
  }
}

function normalizeTaskLists(node) {
  const nextNode = {
    ...node,
    content: node.content?.map(normalizeTaskLists)
  }

  if (nextNode.type !== "bullet_list" && nextNode.type !== "task_list") return nextNode

  const items = (nextNode.content || []).map(item =>
    item.type === "list_item" && isTaskParagraph(item.content?.[0]) ? taskItemFromListItem(item) : item
  )

  if (nextNode.type === "bullet_list" && items.length > 0 && items.every(item => item.type === "task_item")) {
    return {
      type: "task_list",
      content: items
    }
  }

  return {
    ...nextNode,
    content: items
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

    if (listNode.type !== bulletList && listNode.type !== taskList) {
      return null
    }

    const itemPos = $from.before(itemDepth)
    const tr = state.tr.delete(start, end)
    const mappedItemPos = tr.mapping.map(itemPos)
    const currentItem = tr.doc.nodeAt(mappedItemPos)

    if (!currentItem) return null

    if (currentItem.type === taskItem) {
      return tr.setNodeMarkup(mappedItemPos, taskItem, {
        ...currentItem.attrs,
        checked
      })
    }

    if (itemNode.type !== listItem) {
      return null
    }

    if (listNode.childCount === 1 && listNode.type === bulletList) {
      const listPos = $from.before(listDepth)
      const mappedListPos = tr.mapping.map(listPos)
      const currentList = tr.doc.nodeAt(mappedListPos)

      if (!currentList || currentList.childCount !== 1) return null

      const currentListItem = currentList.firstChild
      const nextTaskList = taskList.create(null, [taskItem.create({checked}, currentListItem.content)])

      return tr.replaceWith(mappedListPos, mappedListPos + currentList.nodeSize, nextTaskList)
    }

    return tr.setNodeMarkup(mappedItemPos, taskItem, {checked})
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

function buildHorizontalRuleInputRule(schema) {
  const {horizontal_rule: horizontalRule, paragraph} = schema.nodes

  return new InputRule(/^([-*_])\1\1$/, (state, _match, start, end) => {
    const {$from} = state.selection

    if ($from.parent.type !== paragraph || $from.parent.textContent.length !== end - start) {
      return null
    }

    const blockStart = $from.start()
    const blockEnd = $from.end()

    return state.tr.replaceWith(blockStart - 1, blockEnd + 1, horizontalRule.create()).scrollIntoView()
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
    buildHorizontalRuleInputRule(schema),
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

  return keymap(buildEditorKeyBindings({code, em, strong, listItem, taskItem}))
}

function handleTabCommand(...commands) {
  return (state, dispatch, view) => {
    for (const command of commands) {
      if (command(state, dispatch, view)) {
        return true
      }
    }

    return true
  }
}

function findAncestorDepth($from, predicate) {
  for (let depth = $from.depth; depth >= 0; depth -= 1) {
    if (predicate($from.node(depth), depth)) return depth
  }

  return null
}

function taskText(text = "") {
  return `- [ ] ${text}`
}

function bulletText(text = "") {
  return `- ${text}`
}

export function toggleTaskLineText(line) {
  const uncheckedMatch = line.match(TASK_LINE_PATTERN)

  if (uncheckedMatch) {
    const checked = uncheckedMatch[1].toLowerCase() === "x"
    const content = uncheckedMatch[2] || ""
    return checked ? taskText(content) : bulletText(content)
  }

  const bulletMatch = line.match(BULLET_LINE_PATTERN)

  if (bulletMatch) {
    return taskText(bulletMatch[1] || "")
  }

  return taskText(line)
}

export function toggleTaskLineInText(text, selectionStart, selectionEnd = selectionStart) {
  const hasSelection = selectionEnd !== selectionStart
  const lineStart = text.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1
  const effectiveSelectionEnd =
    hasSelection && selectionEnd > selectionStart && text[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd
  const nextBreak = text.indexOf("\n", effectiveSelectionEnd)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const selectedText = text.slice(lineStart, lineEnd)
  const nextSelectedText = selectedText
    .split("\n")
    .map(line => (line === "" ? line : toggleTaskLineText(line)))
    .join("\n")
  const nextText = `${text.slice(0, lineStart)}${nextSelectedText}${text.slice(lineEnd)}`

  if (hasSelection) {
    return {
      text: nextText,
      selectionStart: lineStart,
      selectionEnd: lineStart + nextSelectedText.length
    }
  }

  const anchorOffset = Math.min(selectionStart - lineStart, nextSelectedText.length)
  const headOffset = Math.min(selectionEnd - lineStart, nextSelectedText.length)

  return {
    text: nextText,
    selectionStart: lineStart + anchorOffset,
    selectionEnd: lineStart + headOffset
  }
}

function createParagraphFromBlock(state, blockNode) {
  const {paragraph} = state.schema.nodes

  if (blockNode.type === paragraph) return blockNode
  if (blockNode.inlineContent) return paragraph.create(null, blockNode.content)
  if (blockNode.textContent === "") return paragraph.create()

  return paragraph.create(null, state.schema.text(blockNode.textContent))
}

function buildItemToggleAction(node, pos, listItem, taskItem) {
  if (node.type === taskItem) {
    if (node.attrs.checked) {
      return {
        kind: "item",
        pos,
        nodeType: taskItem,
        attrs: {
          ...node.attrs,
          checked: false
        }
      }
    }

    return {
      kind: "item",
      pos,
      nodeType: listItem
    }
  }

  if (node.type === listItem) {
    return {
      kind: "item",
      pos,
      nodeType: taskItem,
      attrs: {checked: false}
    }
  }

  return null
}

function buildBlockRunActions(state, blockTargets) {
  const {task_item: taskItem, task_list: taskList} = state.schema.nodes
  const actions = []
  const sortedTargets = [...blockTargets].sort((left, right) => left.pos - right.pos)
  let currentRun = null

  for (const target of sortedTargets) {
    const nextItem = taskItem.create({checked: false}, [createParagraphFromBlock(state, target.node)])
    const targetEnd = target.pos + target.node.nodeSize

    if (
      currentRun &&
      currentRun.parentPos === target.parentPos &&
      currentRun.to === target.pos
    ) {
      currentRun.items.push(nextItem)
      currentRun.to = targetEnd
      continue
    }

    if (currentRun) {
      actions.push({
        kind: "block-run",
        from: currentRun.from,
        to: currentRun.to,
        replacement: taskList.create(null, currentRun.items)
      })
    }

    currentRun = {
      parentPos: target.parentPos,
      from: target.pos,
      to: targetEnd,
      items: [nextItem]
    }
  }

  if (currentRun) {
    actions.push({
      kind: "block-run",
      from: currentRun.from,
      to: currentRun.to,
      replacement: taskList.create(null, currentRun.items)
    })
  }

  return actions
}

function collectToggleActions(state) {
  const {$from, empty, from, to} = state.selection
  const {list_item: listItem, task_item: taskItem} = state.schema.nodes

  if (empty) {
    const itemDepth = findAncestorDepth($from, node => node.type === taskItem || node.type === listItem)

    if (itemDepth !== null) {
      return [buildItemToggleAction($from.node(itemDepth), $from.before(itemDepth), listItem, taskItem)]
    }

    const blockDepth = findAncestorDepth($from, node => node.isTextblock)

    if (blockDepth === null) return []

    const parentDepth = blockDepth - 1

    return buildBlockRunActions(state, [
      {
        pos: $from.before(blockDepth),
        node: $from.node(blockDepth),
        parentPos: parentDepth > 0 ? $from.before(parentDepth) : 0
      }
    ])
  }

  const itemActions = []
  const blockTargets = []
  const seenItems = new Set()
  const seenBlocks = new Set()

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type === taskItem || node.type === listItem) {
      if (!seenItems.has(pos)) {
        const action = buildItemToggleAction(node, pos, listItem, taskItem)

        if (action) {
          itemActions.push(action)
        }

        seenItems.add(pos)
      }

      return false
    }

    if (!node.isTextblock || node.textContent === "") return

    const resolvedPos = state.doc.resolve(Math.min(pos + 1, state.doc.content.size))
    const itemDepth = findAncestorDepth(
      resolvedPos,
      ancestor => ancestor.type === taskItem || ancestor.type === listItem
    )

    if (itemDepth !== null || seenBlocks.has(pos)) {
      return false
    }

    const parentDepth = resolvedPos.depth - 1

    blockTargets.push({
      pos,
      node,
      parentPos: parentDepth > 0 ? resolvedPos.before(parentDepth) : 0
    })
    seenBlocks.add(pos)

    return false
  })

  return [...itemActions, ...buildBlockRunActions(state, blockTargets)]
}

function actionPosition(action) {
  return action.kind === "item" ? action.pos : action.from
}

function clampMappedPosition(tr, position) {
  return Math.max(0, Math.min(tr.mapping.map(position), tr.doc.content.size))
}

function mapSelection(tr, selection) {
  const anchor = clampMappedPosition(tr, selection.anchor)
  const head = clampMappedPosition(tr, selection.head)

  if (anchor === head) {
    return tr.setSelection(Selection.near(tr.doc.resolve(anchor)))
  }

  return tr.setSelection(TextSelection.between(tr.doc.resolve(anchor), tr.doc.resolve(head)))
}

function toggleCurrentLineTask(state, dispatch) {
  const actions = collectToggleActions(state).filter(Boolean)

  if (actions.length === 0) return false

  let tr = state.tr

  for (const action of actions.sort((left, right) => actionPosition(right) - actionPosition(left))) {
    if (action.kind === "item") {
      tr = tr.setNodeMarkup(action.pos, action.nodeType, action.attrs)
      continue
    }

    tr = tr.replaceWith(action.from, action.to, action.replacement)
  }

  tr = mapSelection(tr, state.selection)

  if (dispatch) {
    dispatch(tr.scrollIntoView())
  }

  return true
}

function buildEditorKeyBindings({code, em, strong, listItem, taskItem}) {
  return {
    Enter: chainCommands(
      splitListItemKeepMarks(taskItem, {checked: false}),
      liftListItem(taskItem),
      splitListItemKeepMarks(listItem),
      liftListItem(listItem),
      baseKeymap.Enter
    ),
    Tab: handleTabCommand(sinkListItem(taskItem), sinkListItem(listItem)),
    "Shift-Tab": handleTabCommand(liftListItem(taskItem), liftListItem(listItem)),
    Backspace: chainCommands(undoInputRule, clearCurrentBlockFormatting, baseKeymap.Backspace),
    "Mod-b": toggleMark(strong),
    "Mod-i": toggleMark(em),
    "Mod-`": toggleMark(code),
    "Shift-Mod-l": toggleCurrentLineTask,
    "Mod-z": undo,
    "Shift-Mod-z": redo,
    "Mod-y": redo
  }
}

const editorPlugins = [
  history(),
  inputRules({rules: editorInputRules}),
  buildKeymap(editorSchema),
  new Plugin({
    key: hashtagPluginKey,
    state: {
      init(_, {doc}) {
        return buildHashtagDecorations(doc)
      },
      apply(transaction, decorationSet, _oldState, newState) {
        return transaction.docChanged ? buildHashtagDecorations(newState.doc) : decorationSet
      }
    },
    props: {
      decorations(state) {
        return hashtagPluginKey.getState(state)
      }
    }
  }),
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

function buildHashtagDecorations(doc) {
  const decorations = getHashtagDecorationRanges(doc).map(({from, to}) =>
    Decoration.inline(from, to, {class: "pm-hashtag"})
  )

  return decorations.length === 0 ? DecorationSet.empty : DecorationSet.create(doc, decorations)
}

export function getHashtagDecorationRanges(doc) {
  const ranges = []

  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text || !parent) return
    if (parent.type.name === "heading" || parent.type.name === "code_block") return
    if (node.marks.some(mark => mark.type.name === "code")) return

    HASHTAG_PATTERN.lastIndex = 0

    for (const match of node.text.matchAll(HASHTAG_PATTERN)) {
      const prefix = match[1] || ""
      const hashtag = match[2]
      const from = pos + match.index + prefix.length
      const to = from + hashtag.length

      ranges.push({from, to})
    }
  })

  return ranges
}

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

export function runKeyCommand(state, key) {
  const {code, em, strong} = state.schema.marks
  const {list_item: listItem, task_item: taskItem} = state.schema.nodes
  const command = buildEditorKeyBindings({code, em, strong, listItem, taskItem})[key]

  if (!command) {
    return {state, handled: false}
  }

  let nextState = state
  const handled = command(state, transaction => {
    nextState = state.apply(transaction)
  })

  return {state: handled ? nextState : state, handled}
}

export function applyKeyCommand(state, key) {
  return runKeyCommand(state, key).state
}

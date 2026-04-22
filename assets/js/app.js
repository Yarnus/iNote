import "phoenix_html"
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import topbar from "../vendor/topbar"
import {createMarkdownEditor} from "./markdown_editor.mjs"

const THEME_KEY = "inote:theme"
const EDITOR_MODE_KEY = "inote:editor-mode"

const resolveTheme = mode => {
  if (mode === "dark" || mode === "light") return mode
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

const themeLabel = mode => {
  const toggle = document.querySelector("[data-theme-toggle]")
  if (!toggle) return mode

  const key = `themeLabel${mode.charAt(0).toUpperCase()}${mode.slice(1)}`
  return toggle.dataset[key] || mode
}

const applyTheme = mode => {
  const resolved = resolveTheme(mode)
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themeMode = mode

  if (mode === "system") {
    localStorage.removeItem(THEME_KEY)
  } else {
    localStorage.setItem(THEME_KEY, mode)
  }

  document.querySelectorAll("[data-theme-label]").forEach(node => {
    node.textContent = themeLabel(mode)
  })
}

const currentThemeMode = () => document.documentElement.dataset.themeMode || "system"

document.addEventListener("click", event => {
  const toggle = event.target.closest("[data-theme-toggle]")
  if (!toggle) return

  const nextMode =
    currentThemeMode() === "system"
      ? "dark"
      : currentThemeMode() === "dark"
        ? "light"
        : "system"

  applyTheme(nextMode)
})

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => currentThemeMode() === "system" && applyTheme("system"))

const debounce = (callback, wait) => {
  let timeout

  const debounced = (...args) => {
    window.clearTimeout(timeout)
    timeout = window.setTimeout(() => callback(...args), wait)
  }

  debounced.cancel = () => window.clearTimeout(timeout)

  return debounced
}

const MarkdownEditor = {
  mounted() {
    this.noteId = this.el.dataset.noteId
    this.editorRoot = this.el.querySelector("[data-markdown-editor]")
    this.sourceRoot = this.el.querySelector("[data-markdown-source]")
    this.modeButtons = [...this.el.querySelectorAll("[data-editor-mode-trigger]")]
    this.isSyncing = false
    this.currentMarkdown = this.el.dataset.contentMd || ""
    this.mode = this.restoreMode()

    this.saveDraft = debounce(contentMd => {
      this.pushEvent("autosave_note", {
        id: this.noteId,
        content_md: contentMd
      })
    }, 800)

    this.editor = createMarkdownEditor({
      element: this.editorRoot,
      markdown: this.currentMarkdown,
      placeholder: this.el.dataset.placeholder || "",
      onChange: markdown => {
        if (this.isSyncing) return

        this.currentMarkdown = markdown
        this.syncSourceInput(markdown)
        this.pushEvent("set_status_idle", {})
        this.saveDraft(markdown)
      }
    })

    this.onModeClick = event => {
      const trigger = event.target.closest("[data-editor-mode-trigger]")
      if (!trigger) return

      this.setMode(trigger.dataset.editorModeTrigger, {focus: true})
    }

    this.onSourceInput = event => {
      if (this.isSyncing) return

      this.currentMarkdown = event.target.value
      this.pushEvent("set_status_idle", {})
      this.saveDraft(this.currentMarkdown)
    }

    this.el.addEventListener("click", this.onModeClick)
    this.sourceRoot?.addEventListener("input", this.onSourceInput)
    this.syncSourceInput(this.currentMarkdown)
    this.applyMode({focus: false})
  },

  updated() {
    const nextId = this.el.dataset.noteId
    const nextMarkdown = this.el.dataset.contentMd || ""

    if (nextId !== this.noteId) {
      this.noteId = nextId
      this.syncFromDataset()
      return
    }

    if (!this.isSyncing && nextMarkdown !== this.currentMarkdown) {
      this.syncFromDataset()
    }
  },

  destroyed() {
    this.saveDraft.cancel?.()
    this.el.removeEventListener("click", this.onModeClick)
    this.sourceRoot?.removeEventListener("input", this.onSourceInput)
    this.editor.destroy()
  },

  syncFromDataset() {
    const markdown = this.el.dataset.contentMd || ""

    this.saveDraft.cancel?.()
    this.isSyncing = true
    this.currentMarkdown = markdown
    this.syncSourceInput(markdown)
    this.editor.setMarkdown(markdown)
    this.applyMode({focus: false})
    this.isSyncing = false
  },

  restoreMode() {
    const storedMode = window.localStorage.getItem(EDITOR_MODE_KEY)
    return storedMode === "source" ? "source" : "rich"
  },

  persistMode() {
    window.localStorage.setItem(EDITOR_MODE_KEY, this.mode)
  },

  syncSourceInput(markdown) {
    if (this.sourceRoot) {
      this.sourceRoot.value = markdown
    }
  },

  setMode(mode, {focus = false} = {}) {
    if (mode !== "rich" && mode !== "source") return
    if (mode === this.mode) return

    if (mode === "rich") {
      this.currentMarkdown = this.sourceRoot?.value || ""
      this.isSyncing = true
      this.editor.setMarkdown(this.currentMarkdown)
      this.isSyncing = false
    } else {
      this.currentMarkdown = this.editor.getMarkdown()
      this.syncSourceInput(this.currentMarkdown)
    }

    this.mode = mode
    this.persistMode()
    this.applyMode({focus})
  },

  applyMode({focus = false} = {}) {
    this.el.dataset.editorMode = this.mode

    this.modeButtons.forEach(button => {
      const active = button.dataset.editorModeTrigger === this.mode
      button.classList.toggle("is-active", active)
      button.setAttribute("aria-pressed", active ? "true" : "false")
    })

    if (this.sourceRoot) {
      this.sourceRoot.hidden = this.mode !== "source"
    }

    this.editorRoot.hidden = this.mode !== "rich"

    if (!focus) return

    if (this.mode === "source") {
      this.sourceRoot?.focus()
      return
    }

    this.editor.focusStart()
  }
}

const CopyButton = {
  mounted() {
    this.defaultLabel = this.el.dataset.copyDefault || this.el.textContent.trim()
    this.successLabel = this.el.dataset.copySuccess || this.defaultLabel
    this.resetTimer = null

    this.onClick = async event => {
      event.preventDefault()

      const target = document.getElementById(this.el.dataset.copyTarget)
      if (!target) return

      const text = "value" in target ? target.value : target.innerText
      const copied = await copyText(text, target)

      if (copied) {
        this.el.textContent = this.successLabel
        window.clearTimeout(this.resetTimer)
        this.resetTimer = window.setTimeout(() => {
          this.el.textContent = this.defaultLabel
        }, 1500)
      }
    }

    this.el.addEventListener("click", this.onClick)
  },

  destroyed() {
    window.clearTimeout(this.resetTimer)
    this.el.removeEventListener("click", this.onClick)
  }
}

const copyText = async (text, target) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (_error) {
    if (!("select" in target)) return false

    target.focus()
    target.select()

    try {
      return document.execCommand("copy")
    } finally {
      target.setSelectionRange?.(0, 0)
      target.blur()
    }
  }
}

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content")

let liveSocket = new LiveSocket("/live", Socket, {
  hooks: {CopyButton, MarkdownEditor},
  params: {_csrf_token: csrfToken}
})

topbar.config({barColors: {0: "#7e9cd8"}, shadowColor: "rgba(0, 0, 0, .12)"})
window.addEventListener("phx:page-loading-start", _info => topbar.show(200))
window.addEventListener("phx:page-loading-stop", _info => {
  topbar.hide()
  applyTheme(currentThemeMode())
})

liveSocket.connect()
window.liveSocket = liveSocket

applyTheme(currentThemeMode())

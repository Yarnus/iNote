import "phoenix_html"
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import topbar from "../vendor/topbar"
import {createMarkdownEditor} from "./markdown_editor.mjs"

const THEME_KEY = "inote:theme"

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
    this.isSyncing = false

    this.saveDraft = debounce(contentMd => {
      this.pushEvent("autosave_note", {
        id: this.noteId,
        content_md: contentMd
      })
    }, 800)

    this.editor = createMarkdownEditor({
      element: this.editorRoot,
      markdown: this.el.dataset.contentMd || "",
      placeholder: this.el.dataset.placeholder || "",
      onChange: markdown => {
        if (this.isSyncing) return

        this.pushEvent("set_status_idle", {})
        this.saveDraft(markdown)
      }
    })
  },

  updated() {
    const nextId = this.el.dataset.noteId

    if (nextId !== this.noteId) {
      this.noteId = nextId
      this.syncFromDataset()
    }
  },

  destroyed() {
    this.saveDraft.cancel?.()
    this.editor.destroy()
  },

  syncFromDataset() {
    const markdown = this.el.dataset.contentMd || ""

    this.saveDraft.cancel?.()
    this.isSyncing = true
    this.editor.setMarkdown(markdown)
    this.editor.focusStart()
    this.isSyncing = false
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

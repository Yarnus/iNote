import "phoenix_html"
import {Socket} from "phoenix"
import {LiveSocket} from "phoenix_live_view"
import topbar from "../vendor/topbar"
import {createMarkdownEditor, toggleTaskLineInText} from "./markdown_editor.mjs"

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

const isPrimaryShortcut = event => event.ctrlKey || event.metaKey

const isSearchShortcut = event => isPrimaryShortcut(event) && event.key.toLowerCase() === "f"

const isModeToggleShortcut = event =>
  isPrimaryShortcut(event) &&
  !event.shiftKey &&
  !event.altKey &&
  (event.code === "Slash" || event.key === "/")

const isToggleTaskShortcut = event =>
  isPrimaryShortcut(event) &&
  event.shiftKey &&
  !event.altKey &&
  event.key.toLowerCase() === "l"

const isSaveShortcut = event =>
  isPrimaryShortcut(event) &&
  !event.shiftKey &&
  !event.altKey &&
  event.key.toLowerCase() === "s"

const focusVisibleSearchInput = () => {
  const searchInputs = [...document.querySelectorAll("[data-global-search]")]
  const visibleInput = searchInputs.find(input => !input.hidden && input.offsetParent !== null)

  if (!visibleInput || document.activeElement === visibleInput) return false

  visibleInput.focus()
  visibleInput.select?.()
  return true
}

const focusGlobalSearch = () => {
  if (focusVisibleSearchInput()) return true

  window.dispatchEvent(new CustomEvent("inote:open-nav", {detail: {focusSearch: true}}))
  return true
}

document.addEventListener("keydown", event => {
  if (!isSearchShortcut(event)) return
  if (!focusGlobalSearch()) return

  event.preventDefault()
})

const ResponsiveNav = {
  mounted() {
    this.drawer = this.el.querySelector("[data-nav-drawer]")
    this.backdrop = this.el.querySelector("[data-nav-backdrop]")
    this.toggle = this.el.querySelector("[data-nav-toggle]")
    this.isOpen = false

    this.onClick = event => {
      const toggle = event.target.closest("[data-nav-toggle]")
      if (toggle) {
        event.preventDefault()
        this.open()
        return
      }

      const close = event.target.closest("[data-nav-close]")
      if (close) {
        event.preventDefault()
        this.close()
        return
      }

      const backdrop = event.target.closest("[data-nav-backdrop]")
      if (backdrop) {
        this.close()
      }
    }

    this.onKeydown = event => {
      if (event.key !== "Escape" || !this.isOpen) return

      event.preventDefault()
      this.close()
    }

    this.onWindowOpenNav = event => {
      const focusSearch = Boolean(event.detail?.focusSearch)
      this.open({focusSearch})
    }

    this.onDrawerClick = event => {
      const target = event.target.closest("a")
      if (!target) return

      this.close({restoreFocus: false})
    }

    this.onViewportChange = () => {
      if (!window.matchMedia("(max-width: 1100px)").matches) {
        this.close({restoreFocus: false})
      }
    }

    this.onPageLoadingStart = () => this.close({restoreFocus: false})

    this.el.addEventListener("click", this.onClick)
    this.drawer?.addEventListener("click", this.onDrawerClick)
    window.addEventListener("keydown", this.onKeydown)
    window.addEventListener("inote:open-nav", this.onWindowOpenNav)
    window.matchMedia("(max-width: 1100px)").addEventListener("change", this.onViewportChange)
    window.addEventListener("phx:page-loading-start", this.onPageLoadingStart)
  },

  destroyed() {
    this.el.removeEventListener("click", this.onClick)
    this.drawer?.removeEventListener("click", this.onDrawerClick)
    window.removeEventListener("keydown", this.onKeydown)
    window.removeEventListener("inote:open-nav", this.onWindowOpenNav)
    window.matchMedia("(max-width: 1100px)").removeEventListener("change", this.onViewportChange)
    window.removeEventListener("phx:page-loading-start", this.onPageLoadingStart)
    document.body.classList.remove("is-nav-open")
  },

  open({focusSearch = false} = {}) {
    if (!this.drawer || !this.backdrop || this.isOpen) {
      if (focusSearch) {
        window.requestAnimationFrame(() => focusVisibleSearchInput())
      }
      return
    }

    this.isOpen = true
    this.drawer.hidden = false
    this.backdrop.hidden = false
    this.el.dataset.navOpen = "true"
    this.toggle?.setAttribute("aria-expanded", "true")
    document.body.classList.add("is-nav-open")

    window.requestAnimationFrame(() => {
      const closeButton = this.el.querySelector("[data-nav-close]")

      if (focusSearch) {
        focusVisibleSearchInput()
      } else {
        closeButton?.focus()
      }
    })
  },

  close({restoreFocus = true} = {}) {
    if (!this.drawer || !this.backdrop || !this.isOpen) return

    this.isOpen = false
    this.drawer.hidden = true
    this.backdrop.hidden = true
    delete this.el.dataset.navOpen
    this.toggle?.setAttribute("aria-expanded", "false")
    document.body.classList.remove("is-nav-open")

    if (restoreFocus) {
      this.toggle?.focus()
    }
  }
}

const formatLocalDateTime = (isoValue, locale) => {
  if (!isoValue) return ""

  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ""

  try {
    return new Intl.DateTimeFormat(locale || document.documentElement.lang || undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date)
  } catch (_error) {
    return date.toLocaleString(locale || undefined)
  }
}

const LocalTime = {
  mounted() {
    this.render()
  },

  updated() {
    this.render()
  },

  render() {
    const formatted = formatLocalDateTime(
      this.el.dataset.localDatetime,
      document.documentElement.lang
    )

    if (!formatted) return

    this.el.textContent = formatted
  }
}

const MarkdownEditor = {
  mounted() {
    this.noteId = this.el.dataset.noteId
    this.savedMarkdown = this.el.dataset.contentMd || ""
    this.savedTitle = this.el.dataset.noteTitle || ""
    this.editorRoot = this.el.querySelector("[data-markdown-editor]")
    this.sourceRoot = this.el.querySelector("[data-markdown-source]")
    this.modeButtons = [...this.el.querySelectorAll("[data-editor-mode-trigger]")]
    this.titleInput = this.el.dataset.titleInputId
      ? document.getElementById(this.el.dataset.titleInputId)
      : null
    this.isSyncing = false
    this.currentMarkdown = this.savedMarkdown
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

    this.onSourceKeydown = event => {
      if (isToggleTaskShortcut(event)) {
        event.preventDefault()

        const nextState = toggleTaskLineInText(
          event.target.value,
          event.target.selectionStart,
          event.target.selectionEnd
        )

        event.target.value = nextState.text
        event.target.setSelectionRange(nextState.selectionStart, nextState.selectionEnd)
        event.target.dispatchEvent(new Event("input", {bubbles: true}))
        return
      }

      if (event.key !== "Tab") return

      event.preventDefault()

      if (event.shiftKey) return

      const {selectionStart, selectionEnd, value} = event.target
      const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`

      event.target.value = nextValue
      event.target.setSelectionRange(selectionStart + 1, selectionStart + 1)
      event.target.dispatchEvent(new Event("input", {bubbles: true}))
    }

    this.onEditorKeydown = event => {
      if (isSaveShortcut(event) && this.isSaveShortcutTarget(event.target)) {
        event.preventDefault()
        this.flushSaveNow()
        return
      }

      if (!isModeToggleShortcut(event)) return

      event.preventDefault()
      this.setMode(this.mode === "rich" ? "source" : "rich", {focus: true})
    }

    this.onWindowKeydown = event => {
      if (event.defaultPrevented) return
      if (!isSaveShortcut(event)) return
      if (!this.isSaveShortcutTarget(event.target)) return

      event.preventDefault()
      this.flushSaveNow()
    }

    this.el.addEventListener("click", this.onModeClick)
    this.el.addEventListener("keydown", this.onEditorKeydown)
    this.sourceRoot?.addEventListener("input", this.onSourceInput)
    this.sourceRoot?.addEventListener("keydown", this.onSourceKeydown)
    window.addEventListener("keydown", this.onWindowKeydown)
    this.syncSourceInput(this.currentMarkdown)
    this.applyMode({focus: false})
  },

  updated() {
    const nextId = this.el.dataset.noteId
    const nextMarkdown = this.el.dataset.contentMd || ""
    const nextTitle = this.el.dataset.noteTitle || ""
    this.titleInput = this.el.dataset.titleInputId
      ? document.getElementById(this.el.dataset.titleInputId)
      : null

    if (nextId !== this.noteId) {
      this.noteId = nextId
      this.syncFromDataset()
      return
    }

    if (nextMarkdown === this.currentMarkdown) {
      this.savedMarkdown = nextMarkdown
    }

    this.savedTitle = nextTitle

    if (!this.isSyncing && nextMarkdown !== this.currentMarkdown && !this.isEditorFocused()) {
      this.syncFromDataset()
    }
  },

  destroyed() {
    this.saveDraft.cancel?.()
    this.el.removeEventListener("click", this.onModeClick)
    this.el.removeEventListener("keydown", this.onEditorKeydown)
    this.sourceRoot?.removeEventListener("input", this.onSourceInput)
    this.sourceRoot?.removeEventListener("keydown", this.onSourceKeydown)
    window.removeEventListener("keydown", this.onWindowKeydown)
    this.editor.destroy()
  },

  syncFromDataset() {
    const markdown = this.el.dataset.contentMd || ""
    this.savedMarkdown = markdown
    this.savedTitle = this.el.dataset.noteTitle || ""
    this.titleInput = this.el.dataset.titleInputId
      ? document.getElementById(this.el.dataset.titleInputId)
      : null

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

  isEditorFocused() {
    const activeElement = document.activeElement
    return Boolean(activeElement && this.el.contains(activeElement))
  },

  isSaveShortcutTarget(target) {
    if (!target) return false

    return (
      this.el.contains(target) ||
      Boolean(this.titleInput && (target === this.titleInput || this.titleInput.contains(target)))
    )
  },

  flushSaveNow() {
    this.saveDraft.cancel?.()

    if (this.mode === "rich") {
      this.currentMarkdown = this.editor.getMarkdown()
      this.syncSourceInput(this.currentMarkdown)
    } else {
      this.currentMarkdown = this.sourceRoot?.value || this.currentMarkdown
    }

    if (this.currentMarkdown !== this.savedMarkdown) {
      this.pushEvent("set_status_idle", {})
      this.pushEvent("autosave_note", {
        id: this.noteId,
        content_md: this.currentMarkdown
      })
    }

    const nextTitle = this.titleInput?.value

    if (typeof nextTitle === "string" && nextTitle !== this.savedTitle) {
      this.pushEvent("save_title", {title: nextTitle})
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
  hooks: {CopyButton, LocalTime, MarkdownEditor, ResponsiveNav},
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

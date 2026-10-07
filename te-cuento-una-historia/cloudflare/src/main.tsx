import { Component, type ErrorInfo, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

import { ExperienceShell } from "../../experience-shell"
import styles from "../../te-cuento-una-historia.module.css"

import deployment from "./generated-content.json"
import type { TeCuentoDeployment } from "./content-types"
import "./global.css"

class AppErrorBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Te cuento una historia failed to render", error, info)
    this.props.onError?.()
  }

  render() {
    if (this.state.error) {
      return (
        <main
          className="deployment-error"
          role="alert"
          data-error={this.state.error.message}
        >
          No se pudo iniciar la experiencia. Recargá la página para volver a
          intentarlo.
        </main>
      )
    }

    return this.props.children
  }
}

function App({
  onRuntimeReady,
  onRuntimeError,
  preserveStaticStory,
}: {
  onRuntimeReady?: () => void
  onRuntimeError?: () => void
  preserveStaticStory?: boolean
}) {
  const { content, identity, socialLinks } = deployment as TeCuentoDeployment

  return (
    <main className={styles.page} data-theme="dark" lang={content.inLanguage}>
      <section
        className={styles.serverContext}
        aria-labelledby="te-cuento-server-title"
      >
        <h1 id="te-cuento-server-title">{content.title}</h1>
        <p>{content.serverContext}</p>
      </section>

      <ExperienceShell
        brandName={identity.brandName}
        brandUrl={identity.brandUrl}
        copy={content.interfaceCopy}
        credits={content.credits}
        socialLinks={socialLinks}
        onRuntimeReady={onRuntimeReady}
        onRuntimeError={onRuntimeError}
        preserveStaticStory={preserveStaticStory}
      />
    </main>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Missing application root")

const storyFallback = root.hasAttribute("data-story-fallback") ? root : null
const interactiveRoot = storyFallback ? document.createElement("div") : root
let interactiveReactRoot: ReturnType<typeof createRoot> | null = null

if (storyFallback) {
  interactiveRoot.id = "interactive-root"
  interactiveRoot.dataset.storyPending = "true"
  interactiveRoot.setAttribute("aria-hidden", "true")
  interactiveRoot.inert = true
  storyFallback.after(interactiveRoot)
}

const revealInteractiveStory = () => {
  if (!storyFallback || !storyFallback.isConnected) return
  storyFallback.remove()
  interactiveRoot.removeAttribute("data-story-pending")
  interactiveRoot.removeAttribute("aria-hidden")
  interactiveRoot.inert = false
  interactiveRoot.querySelector<HTMLElement>("#reader-close")?.focus({
    preventScroll: true,
  })
}

const preserveStaticStory = () => {
  if (!storyFallback?.isConnected || storyFallback.dataset.runtimeFailed) return
  storyFallback.dataset.runtimeFailed = "true"
  queueMicrotask(() => {
    if (!storyFallback.isConnected) return
    interactiveReactRoot?.unmount()
    interactiveReactRoot = null
    interactiveRoot.remove()
  })
}

interactiveReactRoot = createRoot(interactiveRoot)
interactiveReactRoot.render(
  <AppErrorBoundary onError={preserveStaticStory}>
    <App
      onRuntimeReady={revealInteractiveStory}
      onRuntimeError={preserveStaticStory}
      preserveStaticStory={storyFallback !== null}
    />
  </AppErrorBoundary>,
)

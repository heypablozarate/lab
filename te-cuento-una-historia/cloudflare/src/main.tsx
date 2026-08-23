import { Component, type ErrorInfo, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

import { ExperienceShell } from "../../experience-shell"
import styles from "../../te-cuento-una-historia.module.css"

import deployment from "./generated-content.json"
import type { TeCuentoDeployment } from "./content-types"
import "./global.css"

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Te cuento una historia failed to render", error, info)
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

function App() {
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
      />
    </main>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("Missing application root")

createRoot(root).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
)

"use client"

import { useState } from "react"

import styles from "../shader-experiment.module.css"
import { WordmarkStage } from "./wordmark-stage"

export type ThemeMode = "light" | "dark"

export function ShaderExperimentShell() {
  const [theme, setTheme] = useState<ThemeMode>("light")

  return (
    <main className={styles.page} data-theme={theme}>
      <h1 className={styles.srOnly}>PabloZarate™</h1>

      <WordmarkStage theme={theme} onThemeChange={setTheme} />

      <footer className={styles.footer}>
        <span>PabloZarate™ — All rights reserved.</span>
      </footer>
    </main>
  )
}

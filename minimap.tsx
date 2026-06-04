"use client";

import styles from "./lab.module.css";

/** Fixed top-center navigation: one tick per panel, click to jump. */
export function Minimap({
  total,
  active,
  labels,
  onJump,
}: {
  total: number;
  active: number;
  labels: string[];
  onJump: (index: number) => void;
}) {
  return (
    <nav className={styles.minimap} aria-label="Lab panels">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          className={styles.tick}
          data-active={i === active}
          aria-label={`Go to ${labels[i] ?? `panel ${i + 1}`}`}
          aria-current={i === active ? "true" : undefined}
          onClick={() => onJump(i)}
        />
      ))}
    </nav>
  );
}

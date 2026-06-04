import styles from "./lab.module.css";

/**
 * PabloZarate™ wordmark following the RAMS signature lineamientos:
 * type-logo family, name at --brand-signature-name-weight, the ™ mark in the
 * brand accent with --brand-wordmark-mark-gap. Colors are bound to the Lab's
 * scoped tokens (--lab-ink / --lab-accent) so the mark adapts to light/dark,
 * which the global RAMS tokens (fixed to the site's light --ink) cannot do here.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className ? `${styles.wordmark} ${className}` : styles.wordmark}>
      <span className={styles.wordmarkName}>PabloZarate</span>
      <span className={styles.wordmarkMark} aria-hidden="true">
        ™
      </span>
    </span>
  );
}

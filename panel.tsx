import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import styles from "./lab.module.css";
import type { LabProject } from "./projects";
import { Wordmark } from "./wordmark";

/** First card — Pablo's Lab identity, presented as staggered clip-reveal lines. */
export function IntroCard({
  top,
  onFocusCard,
}: {
  top: number;
  onFocusCard: () => void;
}) {
  const lineGroups: ReactNode[][] = [
    [
      "This is the",
      "exploratory",
      "playground of",
      <>
        <Wordmark />
      </>,
    ],
    [
      "Welcome to",
      <>
        the Lab<span className={styles.dot}>.</span>
      </>,
    ],
  ];
  let lineIndex = 0;

  return (
    <section
      className={styles.card}
      data-variant="intro"
      style={{ top }}
      aria-labelledby="lab-title"
      tabIndex={-1}
      onFocus={onFocusCard}
    >
      <span className={styles.introShape} aria-hidden="true" />
      <div className={styles.introContent}>
        <h1 id="lab-title" className={styles.introLines}>
          {lineGroups.map((lines, groupIndex) => (
            <span className={styles.introParagraph} key={groupIndex}>
              {lines.map((line, i) => {
                const delay = 0.2 + lineIndex * 0.08;
                lineIndex += 1;

                return (
                  <span className={styles.line} key={i}>
                    <span style={{ animationDelay: `${delay}s` }}>{line}</span>
                  </span>
                );
              })}
            </span>
          ))}
        </h1>
        <p className={styles.introSummary}>
          Design experiments, prototypes, WebGL studies, design systems & other
          stuff — Driven by curiosity. Built at the intersection of technology
          and the liberal arts.
        </p>
      </div>
    </section>
  );
}

/**
 * One card per project. Internal projects link to `/lab/<slug>`; projects with
 * an `href` link out (new tab, ↗ indicator).
 */
export function ProjectCard({
  project,
  number,
  top,
  onFocusCard,
}: {
  project: LabProject;
  number: number;
  top: number;
  onFocusCard: () => void;
}) {
  const style = {
    top,
    ...(project.accent ? { "--lab-accent": project.accent } : {}),
  } as CSSProperties;

  const external = Boolean(project.href);
  const ariaLabel = `${project.title} — ${project.year}, ${project.kind}${
    external ? ", opens in a new tab" : ""
  }`;

  const body = (
    <>
      <span className={styles.cardIndex} aria-hidden="true">
        {String(number).padStart(2, "0")}
      </span>
      <div className={styles.content}>
        <h2 className={styles.cardTitle}>{project.title}</h2>
        <span className={styles.meta}>
          <span>{project.year}</span>
          <span className={styles.metaDivider} aria-hidden="true" />
          <span>{project.kind}</span>
          {external ? (
            <>
              <span className={styles.metaDivider} aria-hidden="true" />
              <span className={styles.external} aria-hidden="true">
                ↗
              </span>
            </>
          ) : null}
        </span>
        <p className={styles.cardDescription}>{project.description}</p>
      </div>
    </>
  );

  if (project.href) {
    return (
      <a
        className={styles.card}
        data-variant="project"
        style={style}
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        onFocus={onFocusCard}
      >
        {body}
      </a>
    );
  }

  return (
    <Link
      className={styles.card}
      data-variant="project"
      style={style}
      href={`/lab/${project.slug}`}
      aria-label={ariaLabel}
      onFocus={onFocusCard}
    >
      {body}
    </Link>
  );
}

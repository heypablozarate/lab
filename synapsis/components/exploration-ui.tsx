"use client";

import { ArrowDownIcon, ArrowLeftIcon, ArrowTopRightIcon, ChevronUpIcon, Cross2Icon, MinusIcon, PlusIcon, ResetIcon } from "@radix-ui/react-icons";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { RamsLink, ramsFieldInputClassName } from "@/components/rams/primitives";
import { trackLabProjectAction } from "@/lib/lab-analytics";
import type { NormalizedSynapsisInterfaceCopy } from "@/lib/synapsis/galaxy-data";
import type { GalaxyCluster, GalaxyEdge, GalaxyNode } from "../layout-engine";
import styles from "../synapsis.module.css";

export type ExplorationCopy = NormalizedSynapsisInterfaceCopy;
export type Connection = { edge: GalaxyEdge; otherTitle: string; otherIndex: number };

export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return <button type="button" className={styles.iconButton} aria-label={label} title={label} {...props}>{children}</button>;
}

export function CloseButton({ copy, onClose }: { copy: ExplorationCopy; onClose: () => void }) {
  return <IconButton label={copy.closeLabel} onClick={onClose}><Cross2Icon aria-hidden="true" /></IconButton>;
}

export function ClearFilters({ copy, active, onClear }: { copy: ExplorationCopy; active: boolean; onClear: () => void }) {
  return <button type="button" className={styles.clearFilters} data-active={active} inert={!active} disabled={!active} aria-hidden={!active} onClick={onClear}>{copy.clearFiltersLabel}</button>;
}

export function SearchField({ id, copy, query, onQuery, results, nodes, onSelect }: {
  id: string; copy: ExplorationCopy; query: string; onQuery: (value: string) => void;
  results: number[]; nodes: GalaxyNode[]; onSelect: (index: number) => void;
}) {
  const [resultsOpen, setResultsOpen] = useState(false);
  return <div className={styles.search}>
    <input id={id} className={ramsFieldInputClassName(styles.searchInput)} type="search" aria-label={copy.searchLabel}
      placeholder={copy.searchLabel} autoComplete="off" value={query} onFocus={() => setResultsOpen(true)} onChange={(event) => { setResultsOpen(true); onQuery(event.target.value); }}
      aria-controls={resultsOpen && query.trim() ? `${id}-results` : undefined} />
    {resultsOpen && query.trim() && <ul id={`${id}-results`} className={styles.searchResults} aria-label={copy.searchLabel}>
      {results.slice(0, 6).map((index) => <li key={nodes[index].id}><button type="button" onClick={() => { setResultsOpen(false); onSelect(index); }}>{nodes[index].title}<ArrowTopRightIcon aria-hidden="true" /></button></li>)}
      {results.length === 0 && <li role="status" className={styles.searchEmpty}>{copy.emptyResultsLabel}</li>}
    </ul>}
  </div>;
}

export function ClusterFilters({ clusters, counts, active, onToggle }: {
  clusters: GalaxyCluster[]; counts: Map<string, number>; active: Set<string>; onToggle: (id: string) => void;
}) {
  return <ul className={styles.clusterList}>{clusters.map((cluster) => <li key={cluster.id}>
    <button type="button" className={styles.clusterRow} data-active={active.has(cluster.id)} aria-pressed={active.has(cluster.id)} onClick={() => onToggle(cluster.id)}>
      <PlusIcon aria-hidden="true" /><span>{cluster.label}</span><span className={styles.clusterCount}>{counts.get(cluster.id) ?? 0}</span>
    </button>
  </li>)}</ul>;
}

export function NodeSummary({ node, cluster, copy, preview }: { node: GalaxyNode; cluster: string; copy: ExplorationCopy; preview: boolean }) {
  return <div data-preview={preview}>
    <p className={styles.nodeMeta}>{cluster}<span className={styles.nodeMetaDetails}> · {node.type} · {copy.relevanceLabel} {node.relevance}</span></p>
    <h2 className={styles.nodeTitle}>{node.title}</h2>
    {node.description && <p className={styles.nodeDescription}>{node.description}</p>}
    {node.tags.length > 0 && <ul className={styles.nodeTags}>{node.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
  </div>;
}

export function SourceLink({ node, copy }: { node: GalaxyNode; copy: ExplorationCopy }) {
  return <RamsLink className={styles.sourceLink} variant="secondary" href={node.url} target="_blank" rel="noopener noreferrer"
    onClick={() => trackLabProjectAction("synapsis", "source_open", { destination_host: new URL(node.url).hostname })}>
    {copy.openLinkLabel.replace(/\s*↗\s*$/u, "")}<ArrowTopRightIcon aria-hidden="true" />
  </RamsLink>;
}

export function Connections({ connections, copy, onSelect }: { connections: Connection[]; copy: ExplorationCopy; onSelect: (index: number) => void }) {
  if (!connections.length) return null;
  return <section className={styles.connections}>
    <h3>{copy.connectionsHeading}</h3><ul>{connections.map(({ edge, otherTitle, otherIndex }) => <li className={styles.connection} key={`${edge.source}-${edge.target}`}>
      <button type="button" onClick={() => onSelect(otherIndex)}>{otherTitle}<ArrowTopRightIcon aria-hidden="true" /></button>
      {edge.rationale?.trim() && <p>{edge.rationale}</p>}
      <span className={styles.provenance}>{edge.provenance === "ai-approved" ? copy.aiApprovedLabel : copy.manualLabel}</span>
    </li>)}</ul>
  </section>;
}

export function ViewportControls({ copy, zoom, onCommand }: { copy: ExplorationCopy; zoom: number; onCommand: (action: "zoom-in" | "zoom-out" | "reset") => void }) {
  return <div className={styles.viewportControls} role="group" aria-label={copy.viewMapLabel}>
    <IconButton label={copy.zoomOutLabel} onClick={() => onCommand("zoom-out")}><MinusIcon aria-hidden="true" /></IconButton>
    <output aria-label={copy.viewMapLabel} aria-live="off">{zoom}%</output>
    <IconButton label={copy.zoomInLabel} onClick={() => onCommand("zoom-in")}><PlusIcon aria-hidden="true" /></IconButton>
    <IconButton label={copy.resetViewLabel} onClick={() => onCommand("reset")}><ResetIcon aria-hidden="true" /></IconButton>
  </div>;
}

export function BackButton({ label, onClick, direction = "back" }: { label: string; onClick: () => void; direction?: "back" | "down" }) {
  return <button type="button" className={styles.backButton} onClick={onClick}>{direction === "down" ? <ArrowDownIcon aria-hidden="true" /> : <ArrowLeftIcon aria-hidden="true" />}{label}</button>;
}

export function ExpandButton({ copy, onClick }: { copy: ExplorationCopy; onClick: () => void }) {
  return <button type="button" className={styles.previewExpand} onClick={onClick}>{copy.expandDetailLabel}<ChevronUpIcon aria-hidden="true" /></button>;
}

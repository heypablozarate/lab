import type { HTMLAttributes } from "react"

type RamsWordmarkProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "header" | "signature"
}
export function RamsWordmark({
  className,
  variant = "header",
  ...props
}: RamsWordmarkProps) {
  const rootClassName = [
    variant === "signature" ? "brand-signature" : "brand-wordmark",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <span className={rootClassName} {...props}>
      {variant === "header" ? (
        <span className="brand-wordmark__intro">Designed by</span>
      ) : null}
      <span
        className={
          variant === "signature"
            ? "brand-signature__name"
            : "brand-wordmark__name"
        }
      >
        PabloZarate
      </span>
      <span
        className={
          variant === "signature"
            ? "brand-signature__mark"
            : "brand-wordmark__mark"
        }
        aria-hidden="true"
      >
        ™
      </span>
    </span>
  )
}

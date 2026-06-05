import { ImageResponse } from "next/og";

export const alt =
  "PabloZarate Lab — product design experiments and digital prototypes";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export function generateLabSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1eeea",
          color: "#1d1b19",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, transparent 599px, rgba(29,27,25,0.09) 600px, transparent 601px), linear-gradient(0deg, transparent 314px, rgba(29,27,25,0.09) 315px, transparent 316px)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 980,
            height: 588,
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid rgba(29,27,25,0.12)",
            background: "rgba(255,255,255,0.62)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 196,
              top: 0,
              width: 588,
              height: 588,
              borderRadius: "50%",
              background: "#ff4b18",
              opacity: 0.12,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 20,
              top: 286,
              display: "flex",
              flexDirection: "column",
              gap: 7,
              alignItems: "center",
            }}
          >
            <div style={{ width: 19, height: 2, background: "#ff4b18" }} />
            <div
              style={{
                width: 15,
                height: 2,
                background: "rgba(29,27,25,0.16)",
              }}
            />
            <div
              style={{
                width: 15,
                height: 2,
                background: "rgba(29,27,25,0.16)",
              }}
            />
            <div
              style={{
                width: 15,
                height: 2,
                background: "rgba(29,27,25,0.16)",
              }}
            />
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 7,
              width: 690,
              paddingLeft: 286,
              paddingTop: 72,
            }}
          >
            {[
              "This is the",
              "exploratory",
              "playground of",
              "PabloZarate™",
              "Welcome to",
              "the Lab",
            ].map((line, index) => (
              <div
                key={line}
                style={{
                  display: "flex",
                  fontSize: index === 3 ? 59 : 57,
                  lineHeight: 0.93,
                  letterSpacing: "-0.04em",
                  fontWeight: index === 3 ? 700 : 400,
                  color: "#1d1b19",
                  whiteSpace: "nowrap",
                }}
              >
                {index === 5 ? (
                  <span style={{ display: "flex" }}>
                    the Lab<span style={{ color: "#ff4b18" }}>.</span>
                  </span>
                ) : (
                  line
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              left: 286,
              bottom: 50,
              display: "flex",
              width: 470,
              fontSize: 17,
              lineHeight: 1.22,
              color: "rgba(29,27,25,0.64)",
            }}
          >
            Design experiments, prototypes, WebGL studies, design systems &
            other stuff — Driven by curiosity. Built at the intersection of
            technology and the liberal arts.
          </div>
        </div>
      </div>
    ),
    size,
  );
}

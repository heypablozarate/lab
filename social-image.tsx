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
          background: "#f4f1ed",
          color: "#1d1b19",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(29,27,25,0.06) 1px, transparent 1px), linear-gradient(0deg, rgba(29,27,25,0.06) 1px, transparent 1px)",
            backgroundSize: "120px 120px",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 112,
            top: 74,
            width: 390,
            height: 390,
            borderRadius: "50%",
            background: "#ff4b18",
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            top: 66,
            bottom: 66,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid rgba(29,27,25,0.12)",
            background: "rgba(255,255,255,0.44)",
            padding: "54px 60px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                fontSize: 24,
                color: "rgba(29,27,25,0.58)",
              }}
            >
              <span>Design</span>
              <span style={{ color: "#ff4b18" }}>Experimentation</span>
              <span>Technology</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "flex-end",
                paddingTop: 6,
              }}
            >
              <div style={{ width: 26, height: 3, background: "#ff4b18" }} />
              <div
                style={{
                  width: 18,
                  height: 2,
                  background: "rgba(29,27,25,0.18)",
                }}
              />
              <div
                style={{
                  width: 18,
                  height: 2,
                  background: "rgba(29,27,25,0.18)",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 104,
                lineHeight: 0.92,
                letterSpacing: "-0.055em",
                maxWidth: 760,
              }}
            >
              <span>PabloZarate</span>
              <span>
                Lab<span style={{ color: "#ff4b18" }}>.</span>
              </span>
            </div>
            <div
              style={{
                maxWidth: 720,
                fontSize: 31,
                lineHeight: 1.14,
                color: "rgba(29,27,25,0.66)",
              }}
            >
              Product design experiments, digital experience prototypes, WebGL
              studies, design systems, and one-person product craft.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: 24,
              color: "rgba(29,27,25,0.58)",
            }}
          >
            <div>lab.pablozarate.com</div>
            <div style={{ display: "flex" }}>
              Designed by <span style={{ color: "#1d1b19" }}>PabloZarate</span>
              <span style={{ color: "#ff4b18" }}>™</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

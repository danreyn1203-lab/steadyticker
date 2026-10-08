import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

// A branded tab icon so the first thing in someone's browser is the mark, not a
// framework default. Same "S" tile as the header wordmark and the OG image.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#22415c",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
          borderRadius: 7,
        }}
      >
        {site.name.charAt(0)}
      </div>
    ),
    size,
  );
}

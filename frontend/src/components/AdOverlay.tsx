import { useState, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";

// Place your ad images in frontend/public/ads/ folder
// Then add their paths here, e.g. "/ads/ad1.png"
const AD_IMAGES: string[] = [
  "/ads/ad1.svg",
  "/ads/ad2.svg",
  "/ads/ad3.svg",
  "/ads/ad4.svg",
  "/ads/ad5.svg",
];

const AD_DURATION = 15000; // 15 seconds per ad

const PLACEHOLDER_ADS = [
  { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", text: "AI Powered" },
  { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", text: "Cloud Native" },
  { bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", text: "Smart Automation" },
  { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", text: "Secure & Fast" },
  { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", text: "Always Online" },
];

export default function AdOverlay({ onClose }: { onClose: () => void }) {
  const agentState = useChatStore((s) => s.agentState);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [shuffled] = useState(() =>
    AD_IMAGES.map((_, i) => i).sort(() => Math.random() - 0.5)
  );

  const hasImages = AD_IMAGES.length > 0;
  const isWorking = agentState === "thinking" || agentState === "executing";

  // Cycle timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => prev + 1);
    }, AD_DURATION);
    return () => clearInterval(timer);
  }, []);

  // Compute which ad to show
  const imgIdx = hasImages ? shuffled[currentIndex % AD_IMAGES.length] : 0;
  const placeholderIdx = currentIndex % PLACEHOLDER_ADS.length;
  const showImage = hasImages && !failedImages.has(imgIdx);

  return (
    <aside
      className="hidden lg:block"
      style={{
        width: "384px",
        minWidth: "384px",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        borderLeft: "1px solid var(--border, #2a2a3a)",
      }}
    >
      {showImage ? (
        <img
          key={imgIdx}
          src={AD_IMAGES[imgIdx]}
          alt="advertisement"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#000",
            display: "block",
          }}
          onError={() => {
            setFailedImages((prev) => new Set(prev).add(imgIdx));
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: PLACEHOLDER_ADS[placeholderIdx].bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
            transition: "background 0.5s ease",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.8 }}>📢</div>
          <div style={{ fontSize: 20, fontWeight: 600, opacity: 0.9 }}>
            {PLACEHOLDER_ADS[placeholderIdx].text}
          </div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.5 }}>
            Ad Space
          </div>
        </div>
      )}

      {/* Close button — only when agent is idle */}
      {!isWorking && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 4,
            background: "rgba(0,0,0,0.65)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
            zIndex: 10,
            backdropFilter: "blur(4px)",
          }}
        >
          ✕ Close Ad
        </button>
      )}
    </aside>
  );
}

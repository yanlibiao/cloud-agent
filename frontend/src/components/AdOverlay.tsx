import { useState, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";

const AD_IMAGES: string[] = [
  "/ads/ad1.svg",
  "/ads/ad2.svg",
  "/ads/ad3.svg",
  "/ads/ad4.svg",
  "/ads/ad5.svg",
];

const AD_DURATION = 15000; // 15 seconds per ad

const PLACEHOLDER_ADS = [
  { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", text: "AI Powered", sub: "Cloud Agent Pro" },
  { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", text: "10x 开发效率", sub: "AI Coding Agent" },
  { bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", text: "云端沙箱", sub: "安全隔离 · 随时随地" },
  { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", text: "企业级安全", sub: "SOC 2 · 数据加密" },
  { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", text: "多模型支持", sub: "DeepSeek · GPT · Claude" },
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => prev + 1);
    }, AD_DURATION);
    return () => clearInterval(timer);
  }, []);

  const imgIdx = hasImages ? shuffled[currentIndex % AD_IMAGES.length] : 0;
  const placeholderIdx = currentIndex % PLACEHOLDER_ADS.length;
  const showImage = hasImages && !failedImages.has(imgIdx);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#000",
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
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.8 }}>📢</div>
          <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.95, marginBottom: 8 }}>
            {PLACEHOLDER_ADS[placeholderIdx].text}
          </div>
          <div style={{ fontSize: 16, opacity: 0.6 }}>
            {PLACEHOLDER_ADS[placeholderIdx].sub}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255,255,255,0.15)",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "rgba(255,255,255,0.5)",
            transition: "width 0.3s linear",
            width: `${((currentIndex % AD_IMAGES.length) + 1) / AD_IMAGES.length * 100}%`,
          }}
        />
      </div>

      {/* Close button — only when agent is idle */}
      {!isWorking && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 6,
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            cursor: "pointer",
            zIndex: 10,
            backdropFilter: "blur(4px)",
          }}
        >
          ✕ 关闭广告
        </button>
      )}
    </div>
  );
}

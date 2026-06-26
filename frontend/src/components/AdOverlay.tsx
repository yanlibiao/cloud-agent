import { useState, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";

const AD_IMAGES: string[] = [
  "/ads/ad1.jpeg",
  "/ads/ad2.jpg",
  "/ads/ad3.jpg",
  "/ads/ad4.jpg",
  "/ads/ad5.jpg",
  "/ads/ad6.jpg",
  "/ads/ad7.jpg",
];

const AD_DURATION = 15000; // 15 seconds per ad

const PLACEHOLDER_ADS = [
  { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", text: "AI Powered", sub: "无穷Agent Pro" },
  { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", text: "10x 开发效率", sub: "AI Coding Agent" },
  { bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", text: "云端沙箱", sub: "安全隔离 · 随时随地" },
  { bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", text: "企业级安全", sub: "SOC 2 · 数据加密" },
  { bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", text: "多模型支持", sub: "DeepSeek · GPT · Claude" },
];

export default function AdOverlay({ onClose }: { onClose: () => void }) {
  const agentState = useChatStore((s) => s.agentState);
  const executionProgress = useChatStore((s) => s.executionProgress);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [shuffled] = useState(() =>
    AD_IMAGES.map((_, i) => i).sort(() => Math.random() - 0.5)
  );

  const hasImages = AD_IMAGES.length > 0;
  const isIdle = agentState === "idle";

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
        display: "flex",
        flexDirection: "column",
        background: "#000",
        position: "relative",
      }}
    >
      {/* Ad content area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
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

        {/* Close button — only when idle (not executing), centered prominently */}
        {isIdle && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              padding: "14px 36px",
              fontSize: 18,
              fontWeight: 700,
              borderRadius: 12,
              background: "rgba(0,0,0,0.75)",
              color: "#fff",
              border: "2px solid rgba(255,255,255,0.6)",
              cursor: "pointer",
              zIndex: 10,
              backdropFilter: "blur(8px)",
              letterSpacing: 2,
            }}
          >
            ✕ 关闭广告
          </button>
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
      </div>

      {/* Status bar below ad — shows agent execution progress */}
      {agentState !== "idle" && agentState !== "error" && (
        <div
          style={{
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "rgba(255,255,255,0.08)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: agentState === "executing" ? "#4ade80" : "#fbbf24",
            animation: agentState === "executing" ? "none" : "pulse 1s ease-in-out infinite",
          }} />
          {agentState === "thinking" && "Agent 正在思考..."}
          {agentState === "executing" && (executionProgress || "Agent 正在执行任务...")}
        </div>
      )}
    </div>
  );
}

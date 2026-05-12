"use client";

import { useRef, useEffect } from "react";

interface AudioWaveformProps {
  isStreaming: boolean;
  audioData?: number[];
}

export default function AudioWaveform({ isStreaming, audioData }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    function drawStreamingWave() {
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      // Subtle grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 0.5;
      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (isStreaming) {
        phaseRef.current += 0.04;

        // Main wave — emerald
        drawWave(ctx, width, height, centerY, {
          amplitude: 25,
          frequency: 0.015,
          phase: phaseRef.current,
          color: "rgba(16, 185, 129, 0.8)",
          lineWidth: 2,
        });

        // Secondary wave — accent
        drawWave(ctx, width, height, centerY, {
          amplitude: 15,
          frequency: 0.025,
          phase: phaseRef.current * 1.3 + 1,
          color: "rgba(16, 185, 129, 0.3)",
          lineWidth: 1.5,
        });

        // Tertiary wave — subtle
        drawWave(ctx, width, height, centerY, {
          amplitude: 8,
          frequency: 0.04,
          phase: phaseRef.current * 0.7 + 2,
          color: "rgba(139, 92, 246, 0.25)",
          lineWidth: 1,
        });

        // Fill gradient below main wave
        const gradient = ctx.createLinearGradient(0, centerY, 0, height);
        gradient.addColorStop(0, "rgba(16, 185, 129, 0.1)");
        gradient.addColorStop(1, "rgba(16, 185, 129, 0)");

        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const y =
            centerY +
            Math.sin(x * 0.015 + phaseRef.current) * 25 +
            Math.sin(x * 0.008 + phaseRef.current * 0.5) * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      } else if (audioData && audioData.length > 0) {
        // Static waveform from completed audio
        drawStaticWaveform(ctx, width, height, centerY, audioData);
      } else {
        // Flat line when idle
        ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animationRef.current = requestAnimationFrame(drawStreamingWave);
    }

    drawStreamingWave();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isStreaming, audioData]);

  return (
    <div className="waveform-container">
      <canvas ref={canvasRef} className="waveform-canvas" />
      <div className="waveform-overlay" />
    </div>
  );
}

interface WaveParams {
  amplitude: number;
  frequency: number;
  phase: number;
  color: string;
  lineWidth: number;
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerY: number,
  params: WaveParams
) {
  ctx.strokeStyle = params.color;
  ctx.lineWidth = params.lineWidth;
  ctx.beginPath();

  for (let x = 0; x < width; x++) {
    const noise = Math.sin(x * 0.05 + params.phase * 2) * 3;
    const y =
      centerY +
      Math.sin(x * params.frequency + params.phase) * params.amplitude +
      noise;

    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
}

function drawStaticWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerY: number,
  data: number[]
) {
  const barWidth = width / data.length;

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(16, 185, 129, 0.6)");
  gradient.addColorStop(0.5, "rgba(16, 185, 129, 0.3)");
  gradient.addColorStop(1, "rgba(16, 185, 129, 0.05)");

  ctx.fillStyle = gradient;

  data.forEach((value, index) => {
    const barHeight = (value / 255) * (height * 0.8);
    const x = index * barWidth;
    const y = centerY - barHeight / 2;

    ctx.fillRect(x, y, Math.max(barWidth - 1, 1), barHeight);
  });
}

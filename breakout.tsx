import { useState, useEffect, useRef, useCallback } from "react";

const CANVAS_W = 480;
const CANVAS_H = 520;
const PADDLE_W = 80;
const PADDLE_H = 12;
const PADDLE_Y = CANVAS_H - 40;
const BALL_R = 8;
const BRICK_COLS = 10;
const BRICK_ROWS = 6;
const BRICK_W = 42;
const BRICK_H = 16;
const BRICK_PAD = 3;
const BRICK_OFFSET_X = 9;
const BRICK_OFFSET_Y = 48;

// Each theme: bg, grid, paddle1, paddle2, paddleGlow, ball, ballGlow, scoreColor, livesColor, brickPalette
const THEMES = [
  {
    name: "VOID",
    bg: "#0D0D1A", grid: "rgba(255,255,255,0.03)",
    paddle: ["#A78BFA", "#C4B5FD"], paddleGlow: "#A78BFA",
    ball: "#FBBF24", ballGlow: "#FBBF24",
    scoreColor: "#C4B5FD", livesColor: "#FB923C",
    hudBg: "rgba(255,255,255,0.06)",
    bricks: ["#FF6B6B","#FF6B6B","#FF9F43","#FF9F43","#54A0FF","#54A0FF"],
    outerBg: "#060610", titleColor: "#C4B5FD", subtitleColor: "#6B6B9A",
    glow: "rgba(167,139,250,0.25)", glowBorder: "rgba(167,139,250,0.15)",
  },
  {
    name: "NEON",
    bg: "#001a00", grid: "rgba(0,255,100,0.04)",
    paddle: ["#00FF87", "#00D4FF"], paddleGlow: "#00FF87",
    ball: "#FF00FF", ballGlow: "#FF00FF",
    scoreColor: "#00FF87", livesColor: "#00D4FF",
    hudBg: "rgba(0,255,100,0.07)",
    bricks: ["#FF00FF","#FF00FF","#00FFFF","#00FFFF","#FFFF00","#FFFF00"],
    outerBg: "#000d00", titleColor: "#00FF87", subtitleColor: "#005533",
    glow: "rgba(0,255,135,0.3)", glowBorder: "rgba(0,255,135,0.2)",
  },
  {
    name: "LAVA",
    bg: "#1a0500", grid: "rgba(255,80,0,0.04)",
    paddle: ["#FF4500", "#FF8C00"], paddleGlow: "#FF4500",
    ball: "#FFD700", ballGlow: "#FFD700",
    scoreColor: "#FF8C00", livesColor: "#FFD700",
    hudBg: "rgba(255,80,0,0.08)",
    bricks: ["#FF1744","#FF1744","#FF6D00","#FF6D00","#FFD600","#FFD600"],
    outerBg: "#0d0200", titleColor: "#FF8C00", subtitleColor: "#5a2000",
    glow: "rgba(255,69,0,0.35)", glowBorder: "rgba(255,69,0,0.2)",
  },
  {
    name: "ICE",
    bg: "#00101a", grid: "rgba(100,220,255,0.04)",
    paddle: ["#00B4D8", "#90E0EF"], paddleGlow: "#00B4D8",
    ball: "#FFFFFF", ballGlow: "#CAF0F8",
    scoreColor: "#90E0EF", livesColor: "#00B4D8",
    hudBg: "rgba(0,180,216,0.07)",
    bricks: ["#ADE8F4","#ADE8F4","#48CAE4","#48CAE4","#0096C7","#0096C7"],
    outerBg: "#000a10", titleColor: "#90E0EF", subtitleColor: "#1a4a5a",
    glow: "rgba(0,180,216,0.3)", glowBorder: "rgba(0,180,216,0.2)",
  },
  {
    name: "CANDY",
    bg: "#1a0020", grid: "rgba(255,100,255,0.04)",
    paddle: ["#FF6FD8", "#FF9EFF"], paddleGlow: "#FF6FD8",
    ball: "#FFE45E", ballGlow: "#FFE45E",
    scoreColor: "#FF9EFF", livesColor: "#FF6FD8",
    hudBg: "rgba(255,100,255,0.07)",
    bricks: ["#FF6FD8","#FF6FD8","#FF9EFF","#FF9EFF","#C77DFF","#C77DFF"],
    outerBg: "#0d0015", titleColor: "#FF9EFF", subtitleColor: "#5a1a6a",
    glow: "rgba(255,111,216,0.3)", glowBorder: "rgba(255,111,216,0.2)",
  },
];

function makeBricks(themeIdx) {
  const palette = THEMES[themeIdx].bricks;
  const bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_PAD),
        y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD),
        alive: true,
        color: palette[r],
        points: (BRICK_ROWS - r) * 10,
      });
    }
  }
  return bricks;
}

function initState() {
  return {
    paddleX: CANVAS_W / 2 - PADDLE_W / 2,
    ball: { x: CANVAS_W / 2, y: PADDLE_Y - BALL_R - 2, vx: 3.2, vy: -3.8 },
    bricks: makeBricks(0),
    score: 0,
    lives: 3,
    phase: "ready",
    particles: [],
    themeIdx: 0,
    flashAlpha: 0, // flash on paddle hit
  };
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function Breakout() {
  const canvasRef = useRef(null);
  const stateRef = useRef(initState());
  const animRef = useRef(null);
  const mouseXRef = useRef(CANVAS_W / 2);
  const [themeIdx, setThemeIdx] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s = stateRef.current;
    const T = THEMES[s.themeIdx];

    // Background
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    ctx.strokeStyle = T.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // Paddle-hit flash overlay
    if (s.flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.flashAlpha * 0.08})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Bricks
    s.bricks.forEach(b => {
      if (!b.alive) return;
      drawRoundRect(ctx, b.x, b.y, BRICK_W, BRICK_H, 3);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(b.x + 4, b.y + 2, BRICK_W - 8, 4);
    });

    // Particles
    s.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Paddle
    const px = s.paddleX;
    const grad = ctx.createLinearGradient(px, PADDLE_Y, px + PADDLE_W, PADDLE_Y);
    grad.addColorStop(0, T.paddle[0]);
    grad.addColorStop(0.5, T.paddle[1]);
    grad.addColorStop(1, T.paddle[0]);
    drawRoundRect(ctx, px, PADDLE_Y, PADDLE_W, PADDLE_H, 6);
    ctx.fillStyle = grad;
    ctx.shadowColor = T.paddleGlow;
    ctx.shadowBlur = 14 + s.flashAlpha * 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ball
    ctx.shadowColor = T.ballGlow;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = T.ball;
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD bar
    ctx.fillStyle = T.hudBg;
    ctx.fillRect(0, 0, CANVAS_W, 36);
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillStyle = T.scoreColor;
    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${String(s.score).padStart(5, "0")}`, 12, 22);
    ctx.textAlign = "center";
    ctx.fillStyle = T.scoreColor;
    ctx.globalAlpha = 0.55;
    ctx.fillText(T.name, CANVAS_W / 2, 22);
    ctx.globalAlpha = 1;
    ctx.textAlign = "right";
    ctx.fillStyle = T.livesColor;
    ctx.fillText(`LIVES  ${"● ".repeat(s.lives).trim()}`, CANVAS_W - 12, 22);

    // Overlay messages
    if (s.phase === "ready") {
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.textAlign = "center";
      ctx.font = "bold 32px 'Courier New', monospace";
      ctx.fillStyle = T.titleColor;
      ctx.fillText("BREAKOUT", CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.font = "13px 'Courier New', monospace";
      ctx.fillStyle = T.ball;
      ctx.fillText("Move mouse · Click to start", CANVAS_W / 2, CANVAS_H / 2 + 18);
      ctx.font = "11px 'Courier New', monospace";
      ctx.fillStyle = T.scoreColor;
      ctx.globalAlpha = 0.6;
      ctx.fillText("Theme changes on every paddle bounce!", CANVAS_W / 2, CANVAS_H / 2 + 42);
      ctx.globalAlpha = 1;
    }

    if (s.phase === "dead") {
      ctx.fillStyle = "rgba(0,0,0,0.82)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.textAlign = "center";
      ctx.font = "bold 30px 'Courier New', monospace";
      ctx.fillStyle = "#FF6B6B";
      ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = T.scoreColor;
      ctx.fillText(`Final Score: ${s.score}`, CANVAS_W / 2, CANVAS_H / 2 + 14);
      ctx.fillStyle = T.ball;
      ctx.fillText("Click to play again", CANVAS_W / 2, CANVAS_H / 2 + 40);
    }

    if (s.phase === "won") {
      ctx.fillStyle = "rgba(0,0,0,0.82)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.textAlign = "center";
      ctx.font = "bold 28px 'Courier New', monospace";
      ctx.fillStyle = "#4ADE80";
      ctx.fillText("YOU WIN! 🎉", CANVAS_W / 2, CANVAS_H / 2 - 20);
      ctx.font = "14px 'Courier New', monospace";
      ctx.fillStyle = T.scoreColor;
      ctx.fillText(`Score: ${s.score}`, CANVAS_W / 2, CANVAS_H / 2 + 14);
      ctx.fillStyle = T.ball;
      ctx.fillText("Click to play again", CANVAS_W / 2, CANVAS_H / 2 + 40);
    }
  }, []);

  const update = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "playing") { draw(); return; }

    // Move paddle
    const targetX = mouseXRef.current - PADDLE_W / 2;
    s.paddleX = Math.max(0, Math.min(CANVAS_W - PADDLE_W, targetX));

    // Move ball
    s.ball.x += s.ball.vx;
    s.ball.y += s.ball.vy;

    // Wall bounces
    if (s.ball.x - BALL_R < 0) { s.ball.x = BALL_R; s.ball.vx *= -1; }
    if (s.ball.x + BALL_R > CANVAS_W) { s.ball.x = CANVAS_W - BALL_R; s.ball.vx *= -1; }
    if (s.ball.y - BALL_R < 36) { s.ball.y = 36 + BALL_R; s.ball.vy *= -1; }

    // Paddle collision — THEME CHANGE here!
    if (
      s.ball.vy > 0 &&
      s.ball.y + BALL_R >= PADDLE_Y &&
      s.ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 4 &&
      s.ball.x >= s.paddleX - 4 &&
      s.ball.x <= s.paddleX + PADDLE_W + 4
    ) {
      const hit = (s.ball.x - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
      s.ball.vx = hit * 5;
      s.ball.vy = -Math.abs(s.ball.vy);
      s.ball.y = PADDLE_Y - BALL_R - 1;

      // 🎨 Advance theme
      const nextTheme = (s.themeIdx + 1) % THEMES.length;
      s.themeIdx = nextTheme;
      // Recolor alive bricks with new theme palette
      const newPalette = THEMES[nextTheme].bricks;
      s.bricks.forEach(b => {
        if (b.alive) {
          const row = Math.round((b.y - BRICK_OFFSET_Y) / (BRICK_H + BRICK_PAD));
          b.color = newPalette[Math.min(row, newPalette.length - 1)];
        }
      });
      s.flashAlpha = 1.0;
      setThemeIdx(nextTheme);
    }

    // Decay flash
    if (s.flashAlpha > 0) s.flashAlpha = Math.max(0, s.flashAlpha - 0.06);

    // Bottom — lose life
    if (s.ball.y - BALL_R > CANVAS_H) {
      s.lives -= 1;
      if (s.lives <= 0) {
        s.phase = "dead";
      } else {
        s.ball = { x: CANVAS_W / 2, y: PADDLE_Y - BALL_R - 2, vx: 3.2 * (Math.random() > 0.5 ? 1 : -1), vy: -3.8 };
      }
    }

    // Brick collisions
    let allGone = true;
    s.bricks.forEach(b => {
      if (!b.alive) return;
      allGone = false;
      const bx2 = b.x + BRICK_W, by2 = b.y + BRICK_H;
      if (
        s.ball.x + BALL_R > b.x &&
        s.ball.x - BALL_R < bx2 &&
        s.ball.y + BALL_R > b.y &&
        s.ball.y - BALL_R < by2
      ) {
        b.alive = false;
        s.score += b.points;
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 2;
          s.particles.push({
            x: b.x + BRICK_W / 2, y: b.y + BRICK_H / 2,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            r: 2 + Math.random() * 2,
            color: b.color,
            life: 30, maxLife: 30,
          });
        }
        const overlapLeft = s.ball.x + BALL_R - b.x;
        const overlapRight = bx2 - (s.ball.x - BALL_R);
        const overlapTop = s.ball.y + BALL_R - b.y;
        const overlapBottom = by2 - (s.ball.y - BALL_R);
        const minH = Math.min(overlapLeft, overlapRight);
        const minV = Math.min(overlapTop, overlapBottom);
        if (minH < minV) s.ball.vx *= -1; else s.ball.vy *= -1;
      }
    });

    if (allGone) s.phase = "won";

    s.particles = s.particles.filter(p => p.life > 0);
    s.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
    });

    draw();
  }, [draw]);

  useEffect(() => {
    const loop = () => { update(); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [update]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseXRef.current = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  }, []);

  const handleClick = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "ready" || s.phase === "dead" || s.phase === "won") {
      stateRef.current = initState();
      stateRef.current.phase = "playing";
      mouseXRef.current = CANVAS_W / 2;
      setThemeIdx(0);
    }
  }, []);

  const T = THEMES[themeIdx];

  return (
    <div style={{
      minHeight: "100vh",
      background: T.outerBg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      padding: "16px",
      transition: "background 0.5s ease",
    }}>
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.25em",
          color: T.subtitleColor,
          textTransform: "uppercase",
          transition: "color 0.4s",
        }}>
          Code in Place · Final Project
        </div>
        <div style={{
          fontSize: 22, fontWeight: "bold",
          color: T.titleColor,
          letterSpacing: "0.12em", marginTop: 4,
          transition: "color 0.4s",
        }}>
          B R E A K O U T
        </div>
      </div>

      {/* Theme pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {THEMES.map((t, i) => (
          <div key={t.name} style={{
            padding: "3px 10px",
            borderRadius: 20,
            fontSize: 10,
            letterSpacing: "0.12em",
            fontWeight: "bold",
            border: `1px solid ${i === themeIdx ? t.paddle[0] : "rgba(255,255,255,0.1)"}`,
            color: i === themeIdx ? t.paddle[0] : "rgba(255,255,255,0.2)",
            background: i === themeIdx ? `${t.paddle[0]}22` : "transparent",
            transition: "all 0.3s",
          }}>
            {t.name}
          </div>
        ))}
      </div>

      <div style={{
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: `0 0 40px ${T.glow}, 0 0 0 1px ${T.glowBorder}`,
        transition: "box-shadow 0.4s ease",
      }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", maxWidth: "100%", cursor: "none" }}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />
      </div>

      <div style={{
        marginTop: 14, fontSize: 11,
        color: T.subtitleColor,
        letterSpacing: "0.15em", textAlign: "center",
        transition: "color 0.4s",
      }}>
        MOVE MOUSE · CLICK TO START · THEME SHIFTS ON EVERY BOUNCE
      </div>
    </div>
  );
}

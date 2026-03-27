import { useRef, useCallback, useEffect } from "react";

interface VirtualJoystickProps {
  onMove: (dx: number, dy: number) => void;
  onJump: () => void;
  onShiftLock?: () => void;
  shiftLocked?: boolean;
}

const VirtualJoystick = ({ onMove, onJump, onShiftLock, shiftLocked }: VirtualJoystickProps) => {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activeTouch = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });
  const moveInterval = useRef<number | null>(null);
  const currentDir = useRef({ dx: 0, dy: 0 });
  const RADIUS = 45;

  const handleStart = useCallback((e: React.TouchEvent) => {
    if (activeTouch.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouch.current = touch.identifier;
    const rect = stickRef.current?.getBoundingClientRect();
    if (rect) center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    if (!moveInterval.current) {
      moveInterval.current = window.setInterval(() => { onMove(currentDir.current.dx, currentDir.current.dy); }, 16);
    }
  }, [onMove]);

  const handleMove = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouch.current) {
        let dx = t.clientX - center.current.x;
        let dy = t.clientY - center.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > RADIUS) { dx = (dx / dist) * RADIUS; dy = (dy / dist) * RADIUS; }
        if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        currentDir.current = { dx: dx / RADIUS, dy: dy / RADIUS };
      }
    }
  }, []);

  const handleEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouch.current) {
        activeTouch.current = null;
        currentDir.current = { dx: 0, dy: 0 };
        if (knobRef.current) knobRef.current.style.transform = `translate(0px, 0px)`;
        if (moveInterval.current) { clearInterval(moveInterval.current); moveInterval.current = null; }
        onMove(0, 0);
      }
    }
  }, [onMove]);

  useEffect(() => { return () => { if (moveInterval.current) clearInterval(moveInterval.current); }; }, []);

  return (
    <>
      {/* Left side: Joystick */}
      <div className="fixed bottom-8 left-6 z-20 pointer-events-auto">
        <div ref={stickRef} onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
          className="relative w-[120px] h-[120px] rounded-full bg-foreground/10 border-2 border-foreground/20 flex items-center justify-center"
          style={{ touchAction: "none" }}>
          <div ref={knobRef} className="w-[50px] h-[50px] rounded-full bg-foreground/30 border-2 border-foreground/40 transition-none"
            style={{ touchAction: "none" }} />
        </div>
      </div>

      {/* Right side: Jump + Shift Lock */}
      <div className="fixed bottom-8 right-6 z-20 pointer-events-auto flex flex-col items-center gap-3">
        {onShiftLock && (
          <button onTouchStart={(e) => { e.preventDefault(); onShiftLock(); }}
            className={`w-[50px] h-[50px] rounded-full border-2 flex items-center justify-center ${shiftLocked ? "bg-primary/30 border-primary/50" : "bg-foreground/10 border-foreground/20"}`}
            style={{ touchAction: "none" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={shiftLocked ? "text-primary" : "text-foreground/60"}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
        )}
        <button onTouchStart={(e) => { e.preventDefault(); onJump(); }}
          className="w-[70px] h-[70px] rounded-full bg-foreground/10 border-2 border-foreground/20 flex items-center justify-center active:bg-foreground/20"
          style={{ touchAction: "none" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/60">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default VirtualJoystick;

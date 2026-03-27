import { useState, useEffect, useRef, useCallback } from "react";
import {
  User, getChatMessages, sendChatMessage, addRating, getRatings, AVATARS,
  getActiveModerationForCurrentUser, dismissCurrentModeration, ModerationAction,
} from "@/lib/store";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Box, Plane, Sky, Text } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Settings, Star, ArrowLeft, Send, X, RotateCcw, AlertTriangle } from "lucide-react";
import * as THREE from "three";
import AdminPanel from "@/components/lobby/AdminPanel";
import VirtualJoystick from "@/components/game/VirtualJoystick";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── Audio ─── */
let audioCtx: AudioContext | null = null;
function getAudioCtx() {
  if (!audioCtx && typeof window !== "undefined") audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}
function playStepSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "triangle"; o.frequency.value = 120 + Math.random() * 40;
  g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.1);
}
function playJumpSound() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(200, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2);
}

/* ─── Shared input ─── */
const keys: Record<string, boolean> = {};
const joystick = { dx: 0, dy: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
}

/* ─── Camera angle shared ref ─── */
const cameraAngleRef = { current: 0 };

/* ─── Collectible coin ─── */
function Coin({ position, onCollect }: { position: [number, number, number]; onCollect: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const [collected, setCollected] = useState(false);
  useFrame((state) => {
    if (!ref.current || collected) return;
    ref.current.rotation.y = state.clock.elapsedTime * 3;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.15;
  });
  if (collected) return null;
  return (
    <mesh ref={ref} position={position} onClick={() => { setCollected(true); onCollect(); }}>
      <cylinderGeometry args={[0.3, 0.3, 0.08, 16]} />
      <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.1} />
    </mesh>
  );
}

/* ─── Player character: moves the parent group ref ─── */
function PlayerCharacter({ color, hat, onCoinsUpdate, groupRef }: { color: string; hat: string; onCoinsUpdate: (n: number) => void; groupRef: React.RefObject<THREE.Group> }) {
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const velocityY = useRef(0);
  const onGround = useRef(true);
  const stepTimer = useRef(0);
  const [coins, setCoins] = useState(0);
  const [coinPositions, setCoinPositions] = useState<[number, number, number][]>(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 15; i++) positions.push([(Math.random() - 0.5) * 40, 1, (Math.random() - 0.5) * 40]);
    return positions;
  });

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;
    const speed = 6 * delta;
    let moving = false;

    const theta = cameraAngleRef.current;
    const forward = new THREE.Vector3(-Math.sin(theta), 0, -Math.cos(theta));
    const right = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));

    let moveX = 0, moveZ = 0;

    if (keys["w"] || keys["arrowup"]) { moveX += forward.x; moveZ += forward.z; }
    if (keys["s"] || keys["arrowdown"]) { moveX -= forward.x; moveZ -= forward.z; }
    if (keys["a"] || keys["arrowleft"]) { moveX -= right.x; moveZ -= right.z; }
    if (keys["d"] || keys["arrowright"]) { moveX += right.x; moveZ += right.z; }

    if (Math.abs(joystick.dx) > 0.1 || Math.abs(joystick.dy) > 0.1) {
      moveX += right.x * joystick.dx + forward.x * (-joystick.dy);
      moveZ += right.z * joystick.dx + forward.z * (-joystick.dy);
    }

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0.01) {
      const mx = (moveX / len) * speed;
      const mz = (moveZ / len) * speed;
      pos.x += mx; pos.z += mz;
      pos.x = Math.max(-24, Math.min(24, pos.x));
      pos.z = Math.max(-24, Math.min(24, pos.z));
      moving = true;
      groupRef.current.rotation.y = Math.atan2(moveX, moveZ);
    }

    if ((keys[" "] || keys["spacebar"]) && onGround.current) {
      velocityY.current = 8; onGround.current = false; playJumpSound();
    }

    velocityY.current -= 20 * delta;
    pos.y += velocityY.current * delta;
    if (pos.y <= 0.85) { pos.y = 0.85; velocityY.current = 0; onGround.current = true; }

    if (moving && onGround.current) {
      const t = state.clock.elapsedTime * 8;
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t) * 0.6;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(t) * 0.6;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -Math.sin(t) * 0.5;
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t) * 0.5;
      stepTimer.current += delta;
      if (stepTimer.current > 0.3) { playStepSound(); stepTimer.current = 0; }
    } else {
      [leftLegRef, rightLegRef, leftArmRef, rightArmRef].forEach(r => { if (r.current) r.current.rotation.x = 0; });
    }

    coinPositions.forEach((cp, i) => {
      const dx = pos.x - cp[0]; const dz = pos.z - cp[2];
      if (Math.sqrt(dx * dx + dz * dz) < 1.2) {
        setCoinPositions(prev => prev.filter((_, j) => j !== i));
        setCoins(c => { const nc = c + 1; onCoinsUpdate(nc); return nc; });
      }
    });
  });

  return (
    <>
      <Box args={[0.8, 0.8, 0.8]} position={[0, 1.6, 0]}><meshStandardMaterial color={color} /></Box>
      <Box args={[0.15, 0.15, 0.05]} position={[-0.2, 1.7, 0.41]}><meshStandardMaterial color="#111" /></Box>
      <Box args={[0.15, 0.15, 0.05]} position={[0.2, 1.7, 0.41]}><meshStandardMaterial color="#111" /></Box>
      <Box args={[0.3, 0.06, 0.05]} position={[0, 1.45, 0.41]}><meshStandardMaterial color="#111" /></Box>
      <Box args={[0.9, 1, 0.5]} position={[0, 0.7, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={leftArmRef} args={[0.3, 0.9, 0.3]} position={[-0.6, 0.75, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={rightArmRef} args={[0.3, 0.9, 0.3]} position={[0.6, 0.75, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={leftLegRef} args={[0.35, 0.9, 0.35]} position={[-0.2, -0.2, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={rightLegRef} args={[0.35, 0.9, 0.35]} position={[0.2, -0.2, 0]}><meshStandardMaterial color={color} /></Box>
      {hat === "cap" && <Box args={[0.9, 0.15, 0.9]} position={[0, 2.05, 0]}><meshStandardMaterial color="#2563eb" /></Box>}
      {hat === "tophat" && (<><Box args={[0.9, 0.1, 0.9]} position={[0, 2.05, 0]}><meshStandardMaterial color="#1a1a2e" /></Box><Box args={[0.6, 0.5, 0.6]} position={[0, 2.35, 0]}><meshStandardMaterial color="#1a1a2e" /></Box></>)}
      {hat === "crown" && <Box args={[0.7, 0.3, 0.7]} position={[0, 2.15, 0]}><meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.2} /></Box>}
      {hat === "halo" && (<mesh position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.4, 0.05, 8, 32]} /><meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={0.5} /></mesh>)}
      {hat === "horns" && (<><Box args={[0.15, 0.35, 0.15]} position={[-0.3, 2.15, 0]} rotation={[0, 0, 0.3]}><meshStandardMaterial color="#dc2626" /></Box><Box args={[0.15, 0.35, 0.15]} position={[0.3, 2.15, 0]} rotation={[0, 0, -0.3]}><meshStandardMaterial color="#dc2626" /></Box></>)}
      {coinPositions.map((pos, i) => <Coin key={i} position={pos} onCollect={() => {}} />)}
    </>
  );
}

/* ─── Camera follow ─── */
function CameraFollower({ playerRef }: { playerRef: React.RefObject<THREE.Group> }) {
  const { camera } = useThree();
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const angle = useRef({ theta: 0, phi: 0.6 });
  const distance = useRef(12);

  useEffect(() => {
    const canvas = document.querySelector("canvas"); if (!canvas) return;
    const onContextMenu = (e: Event) => e.preventDefault();
    const onMouseDown = (e: MouseEvent) => { if (e.button === 2) { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; } };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 2) isDragging.current = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      angle.current.theta -= (e.clientX - lastMouse.current.x) * 0.005;
      angle.current.phi = Math.max(0.1, Math.min(Math.PI / 2.2, angle.current.phi + (e.clientY - lastMouse.current.y) * 0.005));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onWheel = (e: WheelEvent) => { distance.current = Math.max(4, Math.min(25, distance.current + e.deltaY * 0.01)); };

    let camTouchId: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > window.innerWidth * 0.4 && camTouchId === null) {
          camTouchId = t.identifier; lastMouse.current = { x: t.clientX, y: t.clientY }; isDragging.current = true;
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === camTouchId) {
          const t = e.changedTouches[i];
          angle.current.theta -= (t.clientX - lastMouse.current.x) * 0.005;
          angle.current.phi = Math.max(0.1, Math.min(Math.PI / 2.2, angle.current.phi + (t.clientY - lastMouse.current.y) * 0.005));
          lastMouse.current = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => { for (let i = 0; i < e.changedTouches.length; i++) { if (e.changedTouches[i].identifier === camTouchId) { isDragging.current = false; camTouchId = null; } } };

    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("mousedown", onMouseDown); window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove); canvas.addEventListener("wheel", onWheel);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true }); canvas.addEventListener("touchmove", onTouchMove, { passive: true }); canvas.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("contextmenu", onContextMenu); canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp); window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel); canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove); canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useFrame(() => {
    if (!playerRef.current) return;
    const target = playerRef.current.position;
    const d = distance.current;
    camera.position.set(
      target.x + d * Math.sin(angle.current.theta) * Math.cos(angle.current.phi),
      target.y + d * Math.sin(angle.current.phi) + 2,
      target.z + d * Math.cos(angle.current.theta) * Math.cos(angle.current.phi)
    );
    camera.lookAt(target.x, target.y + 1.5, target.z);
    cameraAngleRef.current = angle.current.theta;
  });
  return null;
}

/* ─── Game world ─── */
function GameWorld({ playerColor, playerHat, onCoinsUpdate }: { playerColor: string; playerHat: string; onCoinsUpdate: (n: number) => void }) {
  const playerGroupRef = useRef<THREE.Group>(null!);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <Sky sunPosition={[100, 20, 100]} />
      <Plane args={[50, 50]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]}><meshStandardMaterial color="#4ade80" /></Plane>
      <Text position={[0, 6, -15]} fontSize={2} color="#ffffff" anchorX="center" anchorY="middle" font={undefined}>Made by 3Dr</Text>
      <Text position={[0, 4.5, -15]} fontSize={0.8} color="#a1a1aa" anchorX="center" anchorY="middle" font={undefined}>Use WASD to move · Space to jump · Collect coins!</Text>

      <group ref={playerGroupRef} position={[0, 0.85, 0]}>
        <PlayerCharacter color={playerColor} hat={playerHat} onCoinsUpdate={onCoinsUpdate} groupRef={playerGroupRef} />
      </group>

      <Box args={[3, 1, 3]} position={[5, -0.15, -3]}><meshStandardMaterial color="#f97316" /></Box>
      <Box args={[4, 0.5, 4]} position={[-6, -0.4, 4]}><meshStandardMaterial color="#8b5cf6" /></Box>
      <Box args={[2, 3, 2]} position={[8, 0.85, 6]}><meshStandardMaterial color="#06b6d4" /></Box>
      <Box args={[6, 0.3, 2]} position={[-4, -0.5, -8]}><meshStandardMaterial color="#ec4899" /></Box>
      <Box args={[2, 2, 8]} position={[12, 0.35, 0]}><meshStandardMaterial color="#eab308" /></Box>
      <Box args={[4, 0.3, 6]} position={[-10, 0, 8]} rotation={[0.2, 0, 0]}><meshStandardMaterial color="#14b8a6" /></Box>

      {[[-8, 0, -8], [10, 0, -6], [-3, 0, -10], [7, 0, 10], [-12, 0, -4], [15, 0, 12]].map(([x, _y, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box args={[0.4, 2, 0.4]} position={[0, 0.35, 0]}><meshStandardMaterial color="#92400e" /></Box>
          <Box args={[2, 2, 2]} position={[0, 2.35, 0]}><meshStandardMaterial color="#16a34a" /></Box>
        </group>
      ))}

      <group position={[-15, 0, -12]}>
        <Box args={[4, 3, 4]} position={[0, 0.85, 0]}><meshStandardMaterial color="#d97706" /></Box>
        <Box args={[4.5, 0.3, 4.5]} position={[0, 2.5, 0]} rotation={[0, 0.78, 0]}><meshStandardMaterial color="#dc2626" /></Box>
      </group>

      <CameraFollower playerRef={playerGroupRef} />
    </>
  );
}

const formatDuration = (durationMs?: number) => {
  if (!durationMs) return "an unknown duration";
  const minute = 60 * 1000; const hour = 60 * minute; const week = 7 * 24 * hour; const year = 365 * 24 * hour;
  if (durationMs % year === 0) return `${durationMs / year} year(s)`;
  if (durationMs % week === 0) return `${durationMs / week} week(s)`;
  if (durationMs % hour === 0) return `${durationMs / hour} hour(s)`;
  return `${Math.max(1, Math.round(durationMs / minute))} minute(s)`;
};

const GamePage = ({ user, onBack }: { user: User; onBack: () => void }) => {
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(getChatMessages());
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [moderationNotice, setModerationNotice] = useState<ModerationAction | null>(() => getActiveModerationForCurrentUser());
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const avatar = AVATARS.find((a) => a.id === user.avatar) || AVATARS[0];

  const refreshChat = useCallback(() => { setMessages(getChatMessages()); }, []);
  const refreshModeration = useCallback(() => { setModerationNotice(getActiveModerationForCurrentUser()); }, []);

  useEffect(() => { const i = setInterval(refreshChat, 2000); return () => clearInterval(i); }, [refreshChat]);
  useEffect(() => { const i = setInterval(refreshModeration, 1000); return () => clearInterval(i); }, [refreshModeration]);
  useEffect(() => {
    const off = () => setIsOffline(true); const on = () => setIsOffline(false);
    window.addEventListener("offline", off); window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = () => { if (!chatInput.trim()) return; sendChatMessage(chatInput.trim()); setChatInput(""); refreshChat(); };
  const handleRate = () => { if (rating > 0) { addRating(rating); setRatingSubmitted(true); setTimeout(() => { setShowRating(false); setRatingSubmitted(false); }, 2000); } };
  const handleRetry = () => { setIsOffline(!navigator.onLine); refreshModeration(); };
  const handleLeave = () => { if (moderationNotice?.type === "kick") dismissCurrentModeration(); onBack(); };

  const handleJoystickMove = useCallback((dx: number, dy: number) => { joystick.dx = dx; joystick.dy = dy; }, []);
  const handleJump = useCallback(() => { keys[" "] = true; setTimeout(() => { keys[" "] = false; }, 100); }, []);

  const ratings = getRatings();
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "N/A";

  return (
    <div className="h-screen w-screen relative bg-background select-none">
      <Canvas shadows camera={{ position: [0, 8, 12], fov: 60 }} className="!absolute inset-0">
        <GameWorld playerColor={avatar.color} playerHat={user.hat} onCoinsUpdate={setCoinsCollected} />
      </Canvas>

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
          <button onClick={onBack} className="p-2.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg hover:bg-card transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg text-sm font-bold text-gaming-gold">🪙 {coinsCollected}</div>
          <button onClick={() => setShowRating(true)} className="p-2.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg hover:bg-card transition-colors"><Star className="w-5 h-5 text-gaming-gold" /></button>
          <button onClick={() => setShowChat(!showChat)} className="p-2.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg hover:bg-card transition-colors"><MessageSquare className="w-5 h-5 text-foreground" /></button>
          <button onClick={() => setShowSettings(true)} className="p-2.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg hover:bg-card transition-colors"><Settings className="w-5 h-5 text-foreground" /></button>
        </div>
      </div>

      {/* Admin */}
      {user.isOwner && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
          <button onClick={() => setShowAdmin(!showAdmin)} className="px-4 py-2 bg-destructive/90 backdrop-blur-sm text-destructive-foreground font-bold rounded-lg border border-destructive/50 hover:bg-destructive transition-colors text-sm">Admin</button>
        </div>
      )}
      <AnimatePresence>
        {showAdmin && user.isOwner && (
          <motion.div initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 mt-10 z-30 w-80 max-h-[60vh] overflow-y-auto pointer-events-auto">
            <div className="gaming-card p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-foreground">Admin Panel</h3>
                <button onClick={() => setShowAdmin(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <AdminPanel user={user} refreshUser={() => {}} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-end justify-between pointer-events-none">
        {!isMobile && (
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-sm text-muted-foreground">
            ⭐ {avgRating} &nbsp;|&nbsp; WASD Move · Space Jump · Right-click Camera
          </div>
        )}
        <div className="text-xs text-muted-foreground/60 bg-card/60 backdrop-blur-sm rounded px-2 py-1 ml-auto">Made by 3Dr</div>
      </div>

      {/* Mobile: Virtual Joystick */}
      {isMobile && (
        <div className="absolute bottom-8 left-4 right-4 z-10 flex justify-between items-end pointer-events-none">
          <VirtualJoystick onMove={handleJoystickMove} onJump={handleJump} />
        </div>
      )}

      {/* Chat */}
      <AnimatePresence>
        {showChat && (
          <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="absolute top-0 right-0 bottom-0 w-80 bg-card/95 backdrop-blur-lg border-l border-border z-20 flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-bold text-foreground">Chat</h3>
              <button onClick={() => setShowChat(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`text-sm ${msg.from === user.username ? "text-right" : ""}`}>
                  <span className="text-primary font-bold">{msg.from}: </span>
                  <span className="text-foreground">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Type..." className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <button onClick={handleSend} className="p-2 gaming-gradient rounded-lg"><Send className="w-4 h-4 text-primary-foreground" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="gaming-card p-8 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-display font-bold text-foreground">Game Settings</h3>
              <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-secondary text-secondary-foreground rounded-lg font-bold flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4" /> Reset Position</button>
              <button onClick={() => { setShowSettings(false); onBack(); }} className="w-full py-3 bg-destructive text-destructive-foreground rounded-lg font-bold flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Exit Game</button>
              <button onClick={() => setShowSettings(false)} className="w-full py-2 text-muted-foreground text-sm">Cancel</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection failed */}
      <AnimatePresence>
        {(moderationNotice || isOffline) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/85 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="gaming-card max-w-md w-full p-8 text-center space-y-4 border-destructive/40">
              <div className="flex items-center justify-center"><AlertTriangle className="w-10 h-10 text-destructive" /></div>
              <h3 className="text-2xl font-display font-bold text-foreground">Connection failed</h3>
              {isOffline ? <p className="text-foreground font-medium">Your internet connection was lost.</p> : moderationNotice?.type === "ban" ? <p className="text-foreground font-medium">You have been banned for {formatDuration(moderationNotice.durationMs)}</p> : <p className="text-foreground font-medium">You have been kicked from this server.</p>}
              <p className="text-muted-foreground">reason: {moderationNotice?.reason || "Network interruption"}</p>
              <p className="text-muted-foreground">By: {moderationNotice?.by || "System"}</p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={handleRetry} className="py-2.5 rounded-lg bg-secondary text-secondary-foreground font-bold">Retry</button>
                <button onClick={handleLeave} className="py-2.5 rounded-lg bg-destructive text-destructive-foreground font-bold">Leave</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating */}
      <AnimatePresence>
        {showRating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm z-30 flex items-center justify-center p-4" onClick={() => setShowRating(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="gaming-card p-8 max-w-sm w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-display font-bold text-foreground">Rate This Game</h3>
              {ratingSubmitted ? <p className="text-primary font-bold">Thanks for rating!</p> : (
                <>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (<button key={s} onClick={() => setRating(s)} className="text-3xl transition-transform hover:scale-110">{s <= rating ? "⭐" : "☆"}</button>))}
                  </div>
                  <button onClick={handleRate} className="px-6 py-2 gaming-gradient text-primary-foreground font-bold rounded-lg">Submit</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamePage;

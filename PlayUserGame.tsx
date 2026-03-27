import { useState, useRef, useEffect, useCallback } from "react";
import { User, AVATARS, getActiveModerationForCurrentUser, dismissCurrentModeration, ModerationAction, setInGame, getChatMessages, sendChatMessage } from "@/lib/store";
import { UserGame, GameBlock, incrementPlays, rateGame, joinGameServer, leaveGameServer } from "@/lib/gameStore";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Box, Plane, Sky, Text } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, MessageCircle, Send } from "lucide-react";
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

/* ─── Shared input state ─── */
const keys: Record<string, boolean> = {};
const joystick = { dx: 0, dy: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
}

/* ─── AABB collision ─── */
interface AABB { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; }
function blockToAABB(block: GameBlock): AABB {
  const [px, py, pz] = block.position; const [sx, sy, sz] = block.size;
  return { minX: px - sx / 2, maxX: px + sx / 2, minY: py - sy / 2, maxY: py + sy / 2, minZ: pz - sz / 2, maxZ: pz + sz / 2 };
}
function playerAABB(pos: THREE.Vector3): AABB {
  return { minX: pos.x - 0.45, maxX: pos.x + 0.45, minY: pos.y - 0.85, maxY: pos.y + 1.35, minZ: pos.z - 0.45, maxZ: pos.z + 0.45 };
}
function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/* ─── Render game block ─── */
function GameBlockMesh({ block }: { block: GameBlock }) {
  const [sx, sy, sz] = block.size;
  return (
    <group position={block.position} rotation={block.rotation.map(r => r * Math.PI / 180) as [number, number, number]}>
      {block.type === "sphere" ? (
        <mesh><sphereGeometry args={[sx / 2, 16, 16]} /><meshStandardMaterial color={block.color} /></mesh>
      ) : block.type === "cylinder" ? (
        <mesh><cylinderGeometry args={[sx / 2, sx / 2, sy, 16]} /><meshStandardMaterial color={block.color} /></mesh>
      ) : block.type === "truss" ? (
        <mesh><boxGeometry args={[sx, sy, sz]} /><meshStandardMaterial color={block.color} wireframe /></mesh>
      ) : block.type === "spawn" ? (
        <mesh><boxGeometry args={[sx, sy * 0.2, sz]} /><meshStandardMaterial color="#4ade80" opacity={0.5} transparent /></mesh>
      ) : block.type === "seat" ? (
        <group>
          <mesh position={[0, -sy * 0.25, 0]}><boxGeometry args={[sx, sy * 0.3, sz]} /><meshStandardMaterial color={block.color} /></mesh>
          <mesh position={[0, sy * 0.1, -sz * 0.4]}><boxGeometry args={[sx, sy * 0.6, sz * 0.15]} /><meshStandardMaterial color={block.color} /></mesh>
        </group>
      ) : (
        <mesh><boxGeometry args={[sx, sy, sz]} /><meshStandardMaterial color={block.color} /></mesh>
      )}
    </group>
  );
}

/* ─── Shared camera angle ref ─── */
const cameraAngleRef = { current: 0 };
const shiftLockRef = { current: false };

/* ─── Player ─── */
function Player({ color, blocks, groupRef, username, chatMsg }: {
  color: string; blocks: GameBlock[]; groupRef: React.RefObject<THREE.Group>; username: string; chatMsg: string;
}) {
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const vy = useRef(0);
  const grounded = useRef(true);
  const stepT = useRef(0);
  const climbingRef = useRef(false);

  const solidBlocks = blocks.filter(b => b.type !== "spawn");
  const trussBlocks = blocks.filter(b => b.type === "truss");
  const blockAABBs = solidBlocks.map(b => blockToAABB(b));
  const trussAABBs = trussBlocks.map(b => blockToAABB(b));

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;
    const spd = 6 * delta;
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

    // Check if on truss (climbing)
    const pBox = playerAABB(pos);
    const onTruss = trussAABBs.some(t => aabbOverlap(pBox, t));
    climbingRef.current = onTruss;

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0.01) {
      moveX = (moveX / len) * spd;
      moveZ = (moveZ / len) * spd;
      moving = true;

      pos.x += moveX;
      if (blockAABBs.some(b => aabbOverlap(playerAABB(pos), b))) pos.x -= moveX;
      pos.z += moveZ;
      if (blockAABBs.some(b => aabbOverlap(playerAABB(pos), b))) pos.z -= moveZ;

      // In shift lock, face camera direction
      if (shiftLockRef.current) {
        groupRef.current.rotation.y = theta + Math.PI;
      } else {
        groupRef.current.rotation.y = Math.atan2(moveX, moveZ);
      }
    }

    // Climbing: move up/down on truss
    if (onTruss) {
      if (keys["w"] || keys["arrowup"] || joystick.dy < -0.3) {
        pos.y += spd * 0.8;
        moving = true;
      }
      if (keys["s"] || keys["arrowdown"] || joystick.dy > 0.3) {
        pos.y -= spd * 0.8;
      }
      vy.current = 0;
      // Jump off truss
      if (keys[" "] || keys["spacebar"]) {
        vy.current = 8;
        playJumpSound();
      }
    } else {
      // Jump
      if ((keys[" "] || keys["spacebar"]) && grounded.current) {
        vy.current = 8; grounded.current = false; playJumpSound();
      }
      // Gravity
      vy.current -= 20 * delta;
      pos.y += vy.current * delta;
    }

    let onGround = false;
    if (pos.y <= 0.85) { pos.y = 0.85; vy.current = 0; onGround = true; }

    if (!onTruss) {
      const pAABB2 = playerAABB(pos);
      for (const bAABB of blockAABBs) {
        if (aabbOverlap(pAABB2, bAABB)) {
          if (vy.current <= 0) { pos.y = bAABB.maxY + 0.85; vy.current = 0; onGround = true; }
          else { pos.y = bAABB.minY - 1.35; vy.current = 0; }
          break;
        }
      }
    }
    grounded.current = onGround || onTruss;

    // Animate limbs
    if (moving && grounded.current) {
      const t = state.clock.elapsedTime * 8;
      const limbSwing = onTruss ? 0.8 : 0.6;
      if (leftLeg.current) leftLeg.current.rotation.x = Math.sin(t) * limbSwing;
      if (rightLeg.current) rightLeg.current.rotation.x = -Math.sin(t) * limbSwing;
      if (leftArm.current) leftArm.current.rotation.x = -Math.sin(t) * (onTruss ? 0.8 : 0.5);
      if (rightArm.current) rightArm.current.rotation.x = Math.sin(t) * (onTruss ? 0.8 : 0.5);
      stepT.current += delta;
      if (stepT.current > 0.3) { playStepSound(); stepT.current = 0; }
    } else {
      [leftLeg, rightLeg, leftArm, rightArm].forEach(r => { if (r.current) r.current.rotation.x = 0; });
    }
  });

  return (
    <>
      {/* Chat bubble above head */}
      {chatMsg && (
        <Text position={[0, 2.8, 0]} fontSize={0.3} color="#fff" anchorX="center" anchorY="bottom" maxWidth={4}
          outlineWidth={0.02} outlineColor="#000">{chatMsg}</Text>
      )}
      {/* Username above head */}
      <Text position={[0, 2.4, 0]} fontSize={0.2} color="#fff" anchorX="center" anchorY="bottom"
        outlineWidth={0.01} outlineColor="#000">{username}</Text>
      <Box args={[0.8, 0.8, 0.8]} position={[0, 1.6, 0]}><meshStandardMaterial color={color} /></Box>
      <Box args={[0.15, 0.15, 0.05]} position={[-0.2, 1.7, 0.41]}><meshStandardMaterial color="#111" /></Box>
      <Box args={[0.15, 0.15, 0.05]} position={[0.2, 1.7, 0.41]}><meshStandardMaterial color="#111" /></Box>
      <Box args={[0.9, 1, 0.5]} position={[0, 0.7, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={leftArm} args={[0.3, 0.9, 0.3]} position={[-0.6, 0.75, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={rightArm} args={[0.3, 0.9, 0.3]} position={[0.6, 0.75, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={leftLeg} args={[0.35, 0.9, 0.35]} position={[-0.2, -0.2, 0]}><meshStandardMaterial color={color} /></Box>
      <Box ref={rightLeg} args={[0.35, 0.9, 0.35]} position={[0.2, -0.2, 0]}><meshStandardMaterial color={color} /></Box>
    </>
  );
}

/* ─── Camera: follows player ─── */
function Cam({ playerRef, shiftLocked }: { playerRef: React.RefObject<THREE.Group>; shiftLocked: boolean }) {
  const { camera } = useThree();
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const ang = useRef({ theta: 0, phi: 0.6 });
  const dist = useRef(12);

  useEffect(() => {
    const c = document.querySelector("canvas"); if (!c) return;
    const ctx = (e: Event) => e.preventDefault();
    const md = (e: MouseEvent) => {
      if (e.button === 2 || (shiftLockRef.current && e.button === 0)) {
        dragging.current = true; last.current = { x: e.clientX, y: e.clientY };
      }
    };
    const mu = (e: MouseEvent) => { if (e.button === 2 || e.button === 0) dragging.current = false; };
    const mm = (e: MouseEvent) => {
      // Shift lock: mouse always controls camera
      if (shiftLockRef.current) {
        ang.current.theta -= e.movementX * 0.003;
        ang.current.phi = Math.max(0.1, Math.min(Math.PI / 2.2, ang.current.phi + e.movementY * 0.003));
        return;
      }
      if (!dragging.current) return;
      ang.current.theta -= (e.clientX - last.current.x) * 0.005;
      ang.current.phi = Math.max(0.1, Math.min(Math.PI / 2.2, ang.current.phi + (e.clientY - last.current.y) * 0.005));
      last.current = { x: e.clientX, y: e.clientY };
    };
    const wh = (e: WheelEvent) => { dist.current = Math.max(4, Math.min(25, dist.current + e.deltaY * 0.01)); };

    let camTouchId: number | null = null;
    const ts = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.clientX > window.innerWidth * 0.4 && camTouchId === null) {
          camTouchId = t.identifier; last.current = { x: t.clientX, y: t.clientY }; dragging.current = true;
        }
      }
    };
    const tmv = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === camTouchId) {
          ang.current.theta -= (t.clientX - last.current.x) * 0.005;
          ang.current.phi = Math.max(0.1, Math.min(Math.PI / 2.2, ang.current.phi + (t.clientY - last.current.y) * 0.005));
          last.current = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const te = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === camTouchId) { dragging.current = false; camTouchId = null; }
      }
    };

    c.addEventListener("contextmenu", ctx); c.addEventListener("mousedown", md); window.addEventListener("mouseup", mu);
    window.addEventListener("mousemove", mm); c.addEventListener("wheel", wh);
    c.addEventListener("touchstart", ts, { passive: true }); c.addEventListener("touchmove", tmv, { passive: true }); c.addEventListener("touchend", te);
    return () => {
      c.removeEventListener("contextmenu", ctx); c.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu);
      window.removeEventListener("mousemove", mm); c.removeEventListener("wheel", wh);
      c.removeEventListener("touchstart", ts); c.removeEventListener("touchmove", tmv); c.removeEventListener("touchend", te);
    };
  }, []);

  useFrame(() => {
    if (!playerRef.current) return;
    const t = playerRef.current.position;
    const d = shiftLockRef.current ? 6 : dist.current;
    camera.position.set(
      t.x + d * Math.sin(ang.current.theta) * Math.cos(ang.current.phi),
      t.y + d * Math.sin(ang.current.phi) + 2,
      t.z + d * Math.cos(ang.current.theta) * Math.cos(ang.current.phi)
    );
    camera.lookAt(t.x, t.y + 1.5, t.z);
    cameraAngleRef.current = ang.current.theta;
  });
  return null;
}

const PlayUserGame = ({ user, game, onBack }: { user: User; game: UserGame; onBack: () => void }) => {
  const [showAdmin, setShowAdmin] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [shiftLocked, setShiftLocked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState(getChatMessages());
  const [playerChatMsg, setPlayerChatMsg] = useState("");
  const [serverInfo, setServerInfo] = useState<{ players: number; max: number; serverId: string } | null>(null);
  const [serverFull, setServerFull] = useState(false);
  const playerRef = useRef<THREE.Group>(null!);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const avatar = AVATARS.find(a => a.id === user.avatar) || AVATARS[0];
  const isMobile = useIsMobile();

  useEffect(() => {
    incrementPlays(game.id);
    setInGame(true);

    // Join server
    const result = joinGameServer(game.id, user.username);
    if (result.full) {
      setServerFull(true);
      setServerInfo({ players: result.server.players.length, max: result.server.maxPlayers, serverId: result.server.id });
    } else {
      setServerInfo({ players: result.server.players.length, max: result.server.maxPlayers, serverId: result.server.id });
    }

    return () => { setInGame(false); leaveGameServer(user.username); };
  }, [game.id, user.username]);

  // Poll chat messages
  useEffect(() => {
    const iv = setInterval(() => setChatMessages(getChatMessages()), 2000);
    return () => clearInterval(iv);
  }, []);

  // Shift lock via keyboard
  useEffect(() => {
    let shiftCount = 0;
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Shift" && !(e.target as HTMLElement).matches("input,textarea")) {
        shiftCount++;
        if (shiftCount % 2 === 1) {
          setShiftLocked(prev => {
            const next = !prev;
            shiftLockRef.current = next;
            return next;
          });
        }
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, []);

  const handleRate = () => {
    if (rating > 0) { rateGame(game.id, rating); setRated(true); setTimeout(() => { setShowRating(false); setRated(false); }, 2000); }
  };

  const handleBack = () => { setInGame(false); leaveGameServer(user.username); onBack(); };

  const handleJoystickMove = useCallback((dx: number, dy: number) => {
    joystick.dx = dx; joystick.dy = dy;
  }, []);

  const handleJump = useCallback(() => {
    keys[" "] = true; setTimeout(() => { keys[" "] = false; }, 100);
  }, []);

  const handleShiftLock = useCallback(() => {
    setShiftLocked(prev => {
      const next = !prev;
      shiftLockRef.current = next;
      return next;
    });
  }, []);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setPlayerChatMsg(chatInput.trim());
    setChatInput("");
    setChatMessages(getChatMessages());
    // Clear bubble after 5 seconds
    setTimeout(() => setPlayerChatMsg(""), 5000);
  };

  // Server full screen
  if (serverFull) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center p-4">
        <div className="gaming-card p-8 max-w-sm w-full text-center space-y-4">
          <h3 className="text-xl font-display font-bold text-foreground">Server Full</h3>
          <p className="text-muted-foreground">All servers for <strong>{game.name}</strong> are full ({serverInfo?.max} players max).</p>
          <p className="text-sm text-muted-foreground">1 Player needs to leave</p>
          <button onClick={handleBack} className="w-full py-3 bg-secondary text-secondary-foreground rounded-lg font-bold">✕ Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative bg-background select-none">
      <Canvas shadows camera={{ position: [0, 8, 12], fov: 60 }} className="!absolute inset-0">
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Sky sunPosition={[100, 20, 100]} />
        <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <meshStandardMaterial color="#4ade80" />
        </Plane>
        <Text position={[0, 8, -20]} fontSize={1.5} color="#fff" anchorX="center">{game.name || "Untitled Game"}</Text>
        <Text position={[0, 6.5, -20]} fontSize={0.6} color="#a1a1aa" anchorX="center">by {game.creator}</Text>
        {game.blocks.map(b => <GameBlockMesh key={b.id} block={b} />)}
        <group ref={playerRef} position={[0, 0.85, 0]}>
          <Player color={avatar.color} blocks={game.blocks} groupRef={playerRef} username={user.username} chatMsg={playerChatMsg} />
        </group>
        <Cam playerRef={playerRef} shiftLocked={shiftLocked} />
      </Canvas>

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-10 pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
          <button onClick={handleBack} className="p-2.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        </div>
        <div className="pointer-events-auto flex gap-2 items-center">
          {serverInfo && (
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
              👥 {serverInfo.players}/{serverInfo.max}
            </div>
          )}
          {shiftLocked && !isMobile && (
            <div className="bg-primary/20 border border-primary/30 rounded-lg px-3 py-1.5 text-xs text-primary font-bold">🔒 Shift Lock</div>
          )}
          <button onClick={() => setChatOpen(!chatOpen)} className="p-2.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg">
            <MessageCircle className="w-5 h-5 text-foreground" />
          </button>
          <button onClick={() => setShowRating(true)} className="p-2.5 bg-card/90 backdrop-blur-sm border border-border rounded-lg">
            <Star className="w-5 h-5 text-gaming-gold" />
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}
            className="absolute top-16 left-4 z-20 w-72 max-h-80 bg-card/90 backdrop-blur-sm border border-border rounded-lg flex flex-col pointer-events-auto">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Chat</span>
              <button onClick={() => setChatOpen(false)} className="text-muted-foreground text-xs">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-48">
              {chatMessages.slice(-20).map((m, i) => (
                <div key={i} className="text-xs">
                  <span className="font-bold text-primary">{m.from}: </span>
                  <span className="text-foreground">{m.text}</span>
                </div>
              ))}
              {chatMessages.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>}
            </div>
            <div className="p-2 border-t border-border flex gap-1">
              <input ref={chatInputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSendChat(); }}
                placeholder="Type a message..."
                className="flex-1 px-2 py-1.5 bg-secondary border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <button onClick={handleSendChat} className="p-1.5 bg-primary/20 text-primary rounded hover:bg-primary/30">
                <Send className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin */}
      {user.isOwner && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
          <button onClick={() => setShowAdmin(!showAdmin)} className="px-4 py-2 bg-destructive/90 text-destructive-foreground font-bold rounded-lg text-sm">Admin</button>
        </div>
      )}
      <AnimatePresence>
        {showAdmin && user.isOwner && (
          <motion.div initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 mt-10 z-30 w-80 pointer-events-auto">
            <div className="gaming-card p-4"><AdminPanel user={user} refreshUser={() => {}} /></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
        {!isMobile && (
          <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-sm text-muted-foreground">
            WASD Move · Space Jump · Right-click Camera · Shift: Lock Camera
          </div>
        )}
        <div className="text-xs text-muted-foreground/60 bg-card/60 backdrop-blur-sm rounded px-2 py-1 ml-auto">Made by 3Dr</div>
      </div>

      {/* Mobile controls */}
      {isMobile && (
        <VirtualJoystick onMove={handleJoystickMove} onJump={handleJump}
          onShiftLock={handleShiftLock} shiftLocked={shiftLocked} />
      )}

      {/* Rating */}
      <AnimatePresence>
        {showRating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => setShowRating(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="gaming-card p-8 max-w-sm w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-display font-bold text-foreground">Rate: {game.name}</h3>
              {rated ? <p className="text-primary font-bold">Thanks for rating!</p> : (
                <>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setRating(s)} className="text-3xl hover:scale-110 transition-transform">
                        {s <= rating ? "⭐" : "☆"}
                      </button>
                    ))}
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

export default PlayUserGame;

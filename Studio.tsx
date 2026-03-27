import { useState, useRef, useCallback, useEffect } from "react";
import { User } from "@/lib/store";
import { GameBlock, UserGame, createNewGame, saveGame, BLOCK_TYPES, BLOCK_COLORS } from "@/lib/gameStore";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Box, Plane, Sky, Text, Grid } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Save, Upload, Trash2, Palette, Maximize, RotateCcw, Copy, List, Settings, Play, Plus, Move, Maximize2, RefreshCw } from "lucide-react";
import * as THREE from "three";
import PlayUserGame from "@/pages/PlayUserGame";

type TransformTool = "move" | "scale" | "rotate";

/* ─── Render a single block in 3D ─── */
function BlockMesh({ block, selected, onClick }: { block: GameBlock; selected: boolean; onClick: () => void }) {
  const color = selected ? "#ffffff" : block.color;
  const [sx, sy, sz] = block.size;
  return (
    <group position={block.position} rotation={block.rotation.map(r => r * Math.PI / 180) as [number, number, number]}>
      {block.type === "sphere" ? (
        <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}><sphereGeometry args={[sx / 2, 16, 16]} /><meshStandardMaterial color={color} wireframe={selected} /></mesh>
      ) : block.type === "cylinder" ? (
        <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}><cylinderGeometry args={[sx / 2, sx / 2, sy, 16]} /><meshStandardMaterial color={color} wireframe={selected} /></mesh>
      ) : block.type === "truss" ? (
        <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}><boxGeometry args={[sx, sy, sz]} /><meshStandardMaterial color={color} wireframe /></mesh>
      ) : block.type === "spawn" ? (
        <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
          <mesh><boxGeometry args={[sx, sy * 0.2, sz]} /><meshStandardMaterial color="#4ade80" opacity={0.7} transparent /></mesh>
          <mesh position={[0, sy * 0.3, 0]}><cylinderGeometry args={[0.1, 0.1, sy * 0.4, 8]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} /></mesh>
        </group>
      ) : block.type === "seat" ? (
        <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
          <mesh position={[0, -sy * 0.25, 0]}><boxGeometry args={[sx, sy * 0.3, sz]} /><meshStandardMaterial color={color} wireframe={selected} /></mesh>
          <mesh position={[0, sy * 0.1, -sz * 0.4]}><boxGeometry args={[sx, sy * 0.6, sz * 0.15]} /><meshStandardMaterial color={color} wireframe={selected} /></mesh>
        </group>
      ) : (
        <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}><boxGeometry args={[sx, sy, sz]} /><meshStandardMaterial color={color} wireframe={selected} /></mesh>
      )}
    </group>
  );
}

/* ─── Gizmo: Move arrows ─── */
function MoveGizmo({ block, onMove }: { block: GameBlock; onMove: (axis: number, delta: number) => void }) {
  const colors = ["#ef4444", "#22c55e", "#3b82f6"];
  const dirs: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const rots: [number, number, number][] = [[0, 0, -Math.PI / 2], [0, 0, 0], [Math.PI / 2, 0, 0]];

  return (
    <group position={block.position}>
      {dirs.map((dir, i) => (
        <group key={i} rotation={rots[i]}>
          <mesh position={[0, 1.5, 0]} onClick={(e) => { e.stopPropagation(); onMove(i, 1); }}>
            <coneGeometry args={[0.2, 0.5, 8]} />
            <meshStandardMaterial color={colors[i]} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.4, 8]} />
            <meshStandardMaterial color={colors[i]} />
          </mesh>
          <mesh position={[0, -1.5, 0]} onClick={(e) => { e.stopPropagation(); onMove(i, -1); }}>
            <coneGeometry args={[0.2, 0.5, 8]} />
            <meshStandardMaterial color={colors[i]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Gizmo: Scale handles ─── */
function ScaleGizmo({ block, onScale }: { block: GameBlock; onScale: (axis: number, delta: number) => void }) {
  const colors = ["#ef4444", "#22c55e", "#3b82f6"];
  const dirs: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  return (
    <group position={block.position}>
      {dirs.map((dir, i) => {
        const pos: [number, number, number] = [dir[0] * 1.5, dir[1] * 1.5, dir[2] * 1.5];
        const negPos: [number, number, number] = [dir[0] * -1.5, dir[1] * -1.5, dir[2] * -1.5];
        return (
          <group key={i}>
            <mesh position={pos} onClick={(e) => { e.stopPropagation(); onScale(i, 0.5); }}>
              <boxGeometry args={[0.25, 0.25, 0.25]} />
              <meshStandardMaterial color={colors[i]} />
            </mesh>
            <mesh position={negPos} onClick={(e) => { e.stopPropagation(); onScale(i, -0.5); }}>
              <boxGeometry args={[0.25, 0.25, 0.25]} />
              <meshStandardMaterial color={colors[i]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─── Gizmo: Rotate rings ─── */
function RotateGizmo({ block, onRotate }: { block: GameBlock; onRotate: (axis: number, delta: number) => void }) {
  const colors = ["#ef4444", "#22c55e", "#3b82f6"];
  const rots: [number, number, number][] = [[0, 0, Math.PI / 2], [0, 0, 0], [Math.PI / 2, 0, 0]];

  return (
    <group position={block.position}>
      {rots.map((rot, i) => (
        <group key={i} rotation={rot}>
          <mesh onClick={(e) => { e.stopPropagation(); onRotate(i, 15); }}>
            <torusGeometry args={[1.8 + i * 0.15, 0.06, 8, 32]} />
            <meshStandardMaterial color={colors[i]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ─── Studio Camera with WASD + vertical ─── */
function StudioCamera() {
  const { camera } = useThree();
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const pitch = useRef(-0.5);
  const pos = useRef(new THREE.Vector3(15, 12, 15));

  useEffect(() => {
    const canvas = document.querySelector("canvas"); if (!canvas) return;
    const ctx = (e: Event) => e.preventDefault();
    const md = (e: MouseEvent) => { if (e.button === 2) { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; } };
    const mu = (e: MouseEvent) => { if (e.button === 2) isDragging.current = false; };
    const mm = (e: MouseEvent) => {
      if (!isDragging.current) return;
      yaw.current -= (e.clientX - lastMouse.current.x) * 0.003;
      pitch.current = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitch.current - (e.clientY - lastMouse.current.y) * 0.003));
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const wh = (e: WheelEvent) => {
      const forward = new THREE.Vector3(-Math.sin(yaw.current) * Math.cos(pitch.current), Math.sin(pitch.current), -Math.cos(yaw.current) * Math.cos(pitch.current));
      pos.current.addScaledVector(forward, -e.deltaY * 0.02);
    };

    // Touch support for mobile studio
    let touchId: number | null = null;
    const ts = (e: TouchEvent) => {
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      lastMouse.current = { x: t.clientX, y: t.clientY };
      isDragging.current = true;
    };
    const tmv = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
          yaw.current -= (t.clientX - lastMouse.current.x) * 0.003;
          pitch.current = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitch.current - (t.clientY - lastMouse.current.y) * 0.003));
          lastMouse.current = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const te = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) { isDragging.current = false; touchId = null; }
      }
    };

    canvas.addEventListener("contextmenu", ctx); canvas.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu); window.addEventListener("mousemove", mm); canvas.addEventListener("wheel", wh);
    canvas.addEventListener("touchstart", ts, { passive: true }); canvas.addEventListener("touchmove", tmv, { passive: true }); canvas.addEventListener("touchend", te);
    return () => {
      canvas.removeEventListener("contextmenu", ctx); canvas.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu); window.removeEventListener("mousemove", mm); canvas.removeEventListener("wheel", wh);
      canvas.removeEventListener("touchstart", ts); canvas.removeEventListener("touchmove", tmv); canvas.removeEventListener("touchend", te);
    };
  }, []);

  const studioKeys: Record<string, boolean> = {};
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      studioKeys[e.key.toLowerCase()] = true;
    };
    const ku = (e: KeyboardEvent) => { studioKeys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  useFrame((_, delta) => {
    const speed = 15 * delta;
    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    if (studioKeys["w"]) pos.current.addScaledVector(forward, speed);
    if (studioKeys["s"]) pos.current.addScaledVector(forward, -speed);
    if (studioKeys["a"]) pos.current.addScaledVector(right, -speed);
    if (studioKeys["d"]) pos.current.addScaledVector(right, speed);
    if (studioKeys["e"] || studioKeys[" "]) pos.current.y += speed;
    if (studioKeys["q"] || studioKeys["shift"]) pos.current.y -= speed;

    camera.position.copy(pos.current);
    const lookAt = pos.current.clone().add(new THREE.Vector3(
      -Math.sin(yaw.current) * Math.cos(pitch.current),
      Math.sin(pitch.current),
      -Math.cos(yaw.current) * Math.cos(pitch.current)
    ));
    camera.lookAt(lookAt);
  });

  return null;
}

/* ─── Studio Scene ─── */
function StudioScene({ blocks, selectedId, activeTool, onSelect, onDeselect, onGizmoAction }: {
  blocks: GameBlock[]; selectedId: string | null; activeTool: TransformTool;
  onSelect: (id: string) => void; onDeselect: () => void;
  onGizmoAction: (type: TransformTool, axis: number, delta: number) => void;
}) {
  const selected = blocks.find(b => b.id === selectedId) || null;
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 5]} intensity={1} />
      <Sky sunPosition={[100, 20, 100]} />
      <Grid args={[100, 100]} position={[0, -0.01, 0]} cellColor="#444" sectionColor="#666" fadeDistance={80} />
      <Plane args={[100, 100]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} onClick={onDeselect}>
        <meshStandardMaterial color="#2a2a3e" />
      </Plane>
      <Text position={[0, 8, -20]} fontSize={1.5} color="#a1a1aa" anchorX="center">3Dr Studio</Text>
      {blocks.map(b => (
        <BlockMesh key={b.id} block={b} selected={b.id === selectedId} onClick={() => onSelect(b.id)} />
      ))}
      {/* Gizmos */}
      {selected && activeTool === "move" && <MoveGizmo block={selected} onMove={(axis, delta) => onGizmoAction("move", axis, delta)} />}
      {selected && activeTool === "scale" && <ScaleGizmo block={selected} onScale={(axis, delta) => onGizmoAction("scale", axis, delta)} />}
      {selected && activeTool === "rotate" && <RotateGizmo block={selected} onRotate={(axis, delta) => onGizmoAction("rotate", axis, delta)} />}
      <StudioCamera />
    </>
  );
}

/* ─── Publish Modal ─── */
function PublishModal({ game, onSave, onClose }: { game: UserGame; onSave: (name: string, desc: string, maxPerServer: number) => void; onClose: () => void }) {
  const [name, setName] = useState(game.name);
  const [desc, setDesc] = useState(game.description);
  const [maxPerServer, setMaxPerServer] = useState(game.maxPlayersPerServer || 10);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="gaming-card p-6 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-display font-bold text-foreground">Publish Game</h3>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Game name..."
          className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description..." rows={3}
          className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        <div>
          <label className="text-sm text-muted-foreground">Max players per server (1-50)</label>
          <input type="number" min={1} max={50} value={maxPerServer} onChange={e => setMaxPerServer(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-lg font-bold">Cancel</button>
          <button onClick={() => onSave(name, desc, maxPerServer)} className="flex-1 py-2 gaming-gradient text-primary-foreground rounded-lg font-bold">Publish</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Studio Page ─── */
const Studio = ({ user, onBack, editGame }: { user: User; onBack: () => void; editGame?: UserGame }) => {
  const [game, setGame] = useState<UserGame>(() => editGame || createNewGame(user.username));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [showPublish, setShowPublish] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [activeTool, setActiveTool] = useState<TransformTool>("move");
  const [studSnap, setStudSnap] = useState(1);
  const [testPlay, setTestPlay] = useState(false);
  const [msg, setMsg] = useState("");

  const selected = game.blocks.find(b => b.id === selectedId) || null;
  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 2000); };

  const addBlock = (type: GameBlock["type"]) => {
    const newBlock: GameBlock = {
      id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type, position: [0, 1, 0], size: [2, 2, 2], color: selectedColor, rotation: [0, 0, 0],
    };
    setGame(prev => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
    setSelectedId(newBlock.id);
    setShowAddBlock(false);
    flash(`Added ${BLOCK_TYPES.find(b => b.type === type)?.name || type}`);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const dup: GameBlock = { ...selected, id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, position: [selected.position[0] + 2, selected.position[1], selected.position[2]] as [number, number, number] };
    setGame(prev => ({ ...prev, blocks: [...prev.blocks, dup] }));
    setSelectedId(dup.id);
    flash("Duplicated!");
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setGame(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== selectedId) }));
    setSelectedId(null);
  };

  const updateBlock = (updates: Partial<GameBlock>) => {
    if (!selectedId) return;
    setGame(prev => ({ ...prev, blocks: prev.blocks.map(b => b.id === selectedId ? { ...b, ...updates } : b) }));
  };

  const handleGizmoAction = (type: TransformTool, axis: number, delta: number) => {
    if (!selected) return;
    if (type === "move") {
      const pos = [...selected.position] as [number, number, number];
      pos[axis] += delta * studSnap;
      updateBlock({ position: pos });
    } else if (type === "scale") {
      const sz = [...selected.size] as [number, number, number];
      sz[axis] = Math.max(0.5, sz[axis] + delta);
      updateBlock({ size: sz });
    } else if (type === "rotate") {
      const rot = [...selected.rotation] as [number, number, number];
      rot[axis] += delta;
      updateBlock({ rotation: rot });
    }
  };

  const handleSave = () => {
    if (!game.name) setGame(prev => ({ ...prev, name: `Game by ${user.username}` }));
    saveGame(game);
    flash("Game saved!");
  };

  const handlePublish = (name: string, desc: string, maxPerServer: number) => {
    const updated = { ...game, name: name || `Game by ${user.username}`, description: desc, published: true, maxPlayersPerServer: maxPerServer };
    setGame(updated);
    saveGame(updated);
    setShowPublish(false);
    flash("Game published! 🎉");
  };

  if (testPlay) {
    const testGame: UserGame = { ...game, name: game.name || "Test Game" };
    return <PlayUserGame user={user} game={testGame} onBack={() => setTestPlay(false)} />;
  }

  const tools: { id: TransformTool; icon: any; label: string }[] = [
    { id: "move", icon: Move, label: "Move" },
    { id: "scale", icon: Maximize2, label: "Scale" },
    { id: "rotate", icon: RefreshCw, label: "Rotate" },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/90 backdrop-blur-lg px-2 py-1.5 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-display font-bold gaming-gradient-text hidden sm:block">3Dr Studio</h1>
          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

          {/* Add Block button */}
          <div className="relative">
            <button onClick={() => setShowAddBlock(!showAddBlock)}
              className="flex items-center gap-1 px-3 py-1.5 gaming-gradient text-primary-foreground rounded-lg text-sm font-bold">
              <Plus className="w-4 h-4" /> Add Block
            </button>
            <AnimatePresence>
              {showAddBlock && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl p-2 z-50 w-56 max-h-80 overflow-y-auto">
                  {BLOCK_TYPES.map(bt => (
                    <button key={bt.type} onClick={() => addBlock(bt.type)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-secondary transition-colors">
                      <span className="text-lg">{bt.emoji}</span>
                      <div>
                        <p className="font-medium text-foreground">{bt.name}</p>
                        <p className="text-[10px] text-muted-foreground">{bt.description}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Transform tools */}
          <div className="flex items-center gap-0.5">
            {tools.map(t => (
              <button key={t.id} onClick={() => setActiveTool(t.id)}
                title={t.label}
                className={`p-2 rounded-lg text-sm transition-all flex items-center gap-1 ${activeTool === t.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                <t.icon className="w-4 h-4" />
                <span className="hidden lg:inline text-xs">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

          {/* Stud snap */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <span>Snap:</span>
            {[0.5, 1, 2].map(s => (
              <button key={s} onClick={() => setStudSnap(s)}
                className={`px-1.5 py-0.5 rounded text-xs ${studSnap === s ? "bg-primary/20 text-primary font-bold" : "hover:bg-secondary"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {msg && <span className="text-xs font-bold text-primary hidden sm:block">{msg}</span>}
          <button onClick={() => setTestPlay(true)} title="Test Play"
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm font-bold hover:bg-green-600/30">
            <Play className="w-4 h-4" /> <span className="hidden sm:inline">Test</span>
          </button>
          <button onClick={() => setShowProperties(!showProperties)} title="Properties"
            className={`p-2 rounded-lg text-sm ${showProperties ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => setShowExplorer(!showExplorer)} title="Explorer"
            className={`p-2 rounded-lg text-sm ${showExplorer ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold hover:bg-secondary/80">
            <Save className="w-4 h-4" /> <span className="hidden sm:inline">Save</span>
          </button>
          <button onClick={() => setShowPublish(true)} className="flex items-center gap-1 px-3 py-1.5 gaming-gradient text-primary-foreground rounded-lg text-sm font-bold">
            <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Publish</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative">
          <Canvas shadows camera={{ position: [15, 12, 15], fov: 50 }}>
            <StudioScene blocks={game.blocks} selectedId={selectedId} activeTool={activeTool}
              onSelect={setSelectedId} onDeselect={() => setSelectedId(null)}
              onGizmoAction={handleGizmoAction} />
          </Canvas>

          {/* Selected block quick actions */}
          {selected && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-2 py-1">
              <span className="text-xs text-muted-foreground mr-1">{BLOCK_TYPES.find(b => b.type === selected.type)?.emoji} {BLOCK_TYPES.find(b => b.type === selected.type)?.name}</span>
              <button onClick={duplicateSelected} title="Duplicate" className="p-1.5 text-muted-foreground hover:text-primary rounded"><Copy className="w-4 h-4" /></button>
              <button onClick={deleteSelected} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          )}

          {/* Color picker */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-2 py-1.5">
            {BLOCK_COLORS.map(c => (
              <button key={c} onClick={() => { setSelectedColor(c); if (selected) updateBlock({ color: c }); }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${selectedColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>

          {/* Controls hint */}
          <div className="absolute bottom-12 left-4 z-10 text-[10px] text-muted-foreground/50">
            WASD: Move · Right-click: Look · Scroll: Zoom · E/Q: Up/Down · Click gizmo arrows to transform
          </div>
        </div>

        {/* Explorer */}
        {showExplorer && (
          <div className="w-52 border-l border-border bg-card/50 overflow-y-auto p-3 space-y-2 hidden md:block">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><List className="w-3 h-3" /> Explorer</h3>
            <div className="space-y-0.5">
              {game.blocks.map(b => {
                const bt = BLOCK_TYPES.find(t => t.type === b.type);
                return (
                  <button key={b.id} onClick={() => setSelectedId(b.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all ${b.id === selectedId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                    <span>{bt?.emoji}</span>
                    <span className="truncate">{bt?.name} <span className="text-muted-foreground/60">({b.position.map(p => p.toFixed(0)).join(", ")})</span></span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border">{game.blocks.length} blocks · Made by 3Dr</p>
          </div>
        )}

        {/* Properties */}
        {showProperties && selected && (
          <div className="w-60 border-l border-border bg-card/50 overflow-y-auto p-3 space-y-3 hidden md:block">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Settings className="w-3 h-3" /> Properties</h3>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <p className="text-sm font-bold text-foreground">{BLOCK_TYPES.find(b => b.type === selected.type)?.emoji} {BLOCK_TYPES.find(b => b.type === selected.type)?.name}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Position</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {(["X", "Y", "Z"] as const).map((axis, i) => (
                  <div key={axis}>
                    <span className="text-[10px] text-muted-foreground">{axis}</span>
                    <input type="number" step={studSnap} value={selected.position[i]}
                      onChange={e => { const pos = [...selected.position] as [number, number, number]; pos[i] = parseFloat(e.target.value) || 0; updateBlock({ position: pos }); }}
                      className="w-full px-1.5 py-1 bg-secondary border border-border rounded text-xs text-foreground" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Maximize className="w-3 h-3" /> Size</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {(["W", "H", "D"] as const).map((axis, i) => (
                  <div key={axis}>
                    <span className="text-[10px] text-muted-foreground">{axis}</span>
                    <input type="number" step={0.5} min={0.5} value={selected.size[i]}
                      onChange={e => { const sz = [...selected.size] as [number, number, number]; sz[i] = Math.max(0.5, parseFloat(e.target.value) || 0.5); updateBlock({ size: sz }); }}
                      className="w-full px-1.5 py-1 bg-secondary border border-border rounded text-xs text-foreground" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Rotation (°)</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {(["RX", "RY", "RZ"] as const).map((axis, i) => (
                  <div key={axis}>
                    <span className="text-[10px] text-muted-foreground">{axis}</span>
                    <input type="number" step={15} value={selected.rotation[i]}
                      onChange={e => { const rot = [...selected.rotation] as [number, number, number]; rot[i] = parseFloat(e.target.value) || 0; updateBlock({ rotation: rot }); }}
                      className="w-full px-1.5 py-1 bg-secondary border border-border rounded text-xs text-foreground" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Palette className="w-3 h-3" /> Color</label>
              <div className="grid grid-cols-5 gap-1 mt-1">
                {BLOCK_COLORS.map(c => (
                  <button key={c} onClick={() => updateBlock({ color: c })}
                    className={`w-7 h-7 rounded border-2 ${selected.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-1.5 pt-2">
              <button onClick={duplicateSelected} className="flex-1 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-secondary/80">
                <Copy className="w-3 h-3" /> Duplicate
              </button>
              <button onClick={deleteSelected} className="flex-1 py-1.5 bg-destructive/10 text-destructive rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-destructive/20">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPublish && <PublishModal game={game} onSave={handlePublish} onClose={() => setShowPublish(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Studio;

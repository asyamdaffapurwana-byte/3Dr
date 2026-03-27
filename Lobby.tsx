import { useState, useEffect, useCallback } from "react";
import { getCurrentUser, logout, claimDailyReward, User } from "@/lib/store";
import { UserGame, getGameById } from "@/lib/gameStore";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, User as UserIcon, Users, Shirt, LogOut, Gift, Star, Hammer } from "lucide-react";
import Profile from "@/components/lobby/Profile";
import Friends from "@/components/lobby/Friends";
import AvatarCustomizer from "@/components/lobby/AvatarCustomizer";
import AdminPanel from "@/components/lobby/AdminPanel";
import GamesBrowser from "@/components/lobby/GamesBrowser";
import Studio from "@/pages/Studio";
import PlayUserGame from "@/pages/PlayUserGame";

type Tab = "home" | "profile" | "friends" | "avatar" | "games";

const Lobby = ({ onLogout }: { onLogout: () => void }) => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [tab, setTab] = useState<Tab>("home");
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [dailyRewardMsg, setDailyRewardMsg] = useState("");
  const [studioMode, setStudioMode] = useState(false);
  const [editingGame, setEditingGame] = useState<UserGame | undefined>(undefined);
  const [playingGame, setPlayingGame] = useState<UserGame | null>(null);

  const refreshUser = useCallback(() => { setUser(getCurrentUser()); }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "3dr_current_user" || event.key === "3dr_users") refreshUser();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshUser]);

  const handleClaimDaily = () => {
    const result = claimDailyReward();
    if (result.success) {
      setDailyRewardMsg(`+${result.amount.toLocaleString()} Points claimed!`);
      refreshUser();
      setTimeout(() => setDailyRewardMsg(""), 3000);
    } else {
      setDailyRewardMsg("Already claimed today!");
      setTimeout(() => setDailyRewardMsg(""), 2000);
    }
  };

  const handleLogout = () => { logout(); onLogout(); };

  const handleJoinGame = (gameId: string) => {
    const game = getGameById(gameId);
    if (game) setPlayingGame(game);
  };

  if (!user) return null;

  if (studioMode) return (
    <Studio user={user} onBack={() => { setStudioMode(false); setEditingGame(undefined); refreshUser(); }} editGame={editingGame} />
  );

  if (playingGame) return <PlayUserGame user={user} game={playingGame} onBack={() => { setPlayingGame(null); refreshUser(); }} />;

  const handleEditGame = (game: UserGame) => { setEditingGame(game); setStudioMode(true); };

  const navItems = [
    { id: "home" as Tab, icon: Gamepad2, label: "Home" },
    { id: "games" as Tab, icon: Hammer, label: "Games" },
    { id: "profile" as Tab, icon: UserIcon, label: "Profile" },
    { id: "friends" as Tab, icon: Users, label: "Friends" },
    { id: "avatar" as Tab, icon: Shirt, label: "Avatar" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gaming-gradient flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-display font-bold gaming-gradient-text">3Dr</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg">
              <Star className="w-4 h-4 text-gaming-gold" />
              <span className="font-bold text-sm text-foreground">{user.points.toLocaleString()}</span>
            </div>
            {user.isOwner && user.title && (
              <button onClick={() => setTab("home")} className="px-3 py-1.5 bg-destructive/20 text-destructive rounded-lg text-sm font-bold border border-destructive/30">{user.title}</button>
            )}
            <button onClick={() => setShowLogoutWarning(true)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <nav className="md:w-56 border-b md:border-b-0 md:border-r border-border bg-card/50 overflow-x-auto">
          <div className="flex md:flex-col p-2 gap-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  tab === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}>
                <item.icon className="w-5 h-5" /><span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === "home" && (
              <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-foreground">Welcome, {user.username}!</h2>
                    <p className="text-muted-foreground">Ready to play?</p>
                  </div>
                  <button onClick={handleClaimDaily} className="flex items-center gap-2 px-4 py-2 gold-gradient text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity">
                    <Gift className="w-5 h-5" /> Claim Daily Reward
                  </button>
                </div>
                {dailyRewardMsg && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-gaming-gold/10 border border-gaming-gold/30 text-gaming-gold px-4 py-3 rounded-lg font-bold text-center">{dailyRewardMsg}</motion.div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button onClick={() => setTab("games")} className="gaming-card p-6 text-left">
                    <Hammer className="w-8 h-8 text-gaming-blue mb-3" />
                    <h4 className="font-display font-bold text-foreground">Games</h4>
                    <p className="text-sm text-muted-foreground">Play & create games</p>
                  </button>
                  <button onClick={() => setTab("friends")} className="gaming-card p-6 text-left">
                    <Users className="w-8 h-8 text-gaming-purple mb-3" />
                    <h4 className="font-display font-bold text-foreground">Friends</h4>
                    <p className="text-sm text-muted-foreground">{user.friends.length} friends</p>
                  </button>
                  <button onClick={() => setTab("avatar")} className="gaming-card p-6 text-left">
                    <Shirt className="w-8 h-8 text-gaming-pink mb-3" />
                    <h4 className="font-display font-bold text-foreground">Avatar</h4>
                    <p className="text-sm text-muted-foreground">Customize your look</p>
                  </button>
                </div>
                {user.isOwner && <AdminPanel user={user} refreshUser={refreshUser} />}
              </motion.div>
            )}
            {tab === "games" && (
              <GamesBrowser user={user} onPlayGame={g => setPlayingGame(g)} onCreateGame={() => { setEditingGame(undefined); setStudioMode(true); }} onEditGame={handleEditGame} />
            )}
            {tab === "profile" && <Profile user={user} />}
            {tab === "friends" && <Friends user={user} refreshUser={refreshUser} onJoinGame={handleJoinGame} />}
            {tab === "avatar" && <AvatarCustomizer user={user} refreshUser={refreshUser} />}
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {showLogoutWarning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowLogoutWarning(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="gaming-card p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
              <LogOut className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold text-foreground mb-2">Log Out?</h3>
              <p className="text-muted-foreground mb-6">Are you sure you want to leave 3Dr?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowLogoutWarning(false)} className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-lg font-bold">Cancel</button>
                <button onClick={handleLogout} className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-lg font-bold">Log Out</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Lobby;

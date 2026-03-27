import { useState, useEffect } from "react";
import { User, sendFriendRequest, acceptFriend, declineFriend, getCurrentUser, getTotalUsers, getOnlineUsers, getInGameUsers, heartbeat, getAllUsers } from "@/lib/store";
import { getPlayerCurrentGame, getGameById } from "@/lib/gameStore";
import { motion } from "framer-motion";
import { UserPlus, Check, X, Search, Users, Globe, Gamepad2, Play } from "lucide-react";

const Friends = ({ user, refreshUser, onJoinGame }: { user: User; refreshUser: () => void; onJoinGame?: (gameId: string) => void }) => {
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [totalUsers, setTotalUsers] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [inGameCount, setInGameCount] = useState(0);

  useEffect(() => {
    const update = () => {
      heartbeat();
      setTotalUsers(getTotalUsers());
      setOnlineCount(getOnlineUsers().length);
      setInGameCount(getInGameUsers().length);
    };
    update();
    const iv = setInterval(update, 5000);
    return () => clearInterval(iv);
  }, []);

  const handleAdd = () => {
    if (!search.trim()) return;
    const result = sendFriendRequest(search.trim());
    if (result.success) { setMsg("Friend request sent!"); setSearch(""); }
    else { setMsg(result.error || "Error"); }
    setTimeout(() => setMsg(""), 2000);
  };

  const handleAccept = (from: string) => { acceptFriend(from); refreshUser(); };
  const handleDecline = (from: string) => { declineFriend(from); refreshUser(); };

  const fresh = getCurrentUser();
  const requests = fresh?.friendRequests || [];
  const friends = fresh?.friends || [];

  // Get friend game info
  const getFriendGameInfo = (friendName: string) => {
    const pg = getPlayerCurrentGame(friendName);
    if (!pg) return null;
    const game = getGameById(pg.gameId);
    return game ? { gameId: pg.gameId, gameName: game.name || "Untitled" } : null;
  };

  // Check if friend is online
  const allUsers = getAllUsers();
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const isFriendOnline = (name: string) => {
    const u = allUsers.find(u => u.username === name);
    return u ? u.lastOnline > fiveMinAgo : false;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-3xl font-display font-bold text-foreground">Friends</h2>

      {/* Player Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="gaming-card p-4 text-center">
          <Users className="w-6 h-6 text-primary mx-auto mb-1" />
          <p className="text-2xl font-display font-bold text-foreground">{totalUsers}</p>
          <p className="text-xs text-muted-foreground">Total Players</p>
        </div>
        <div className="gaming-card p-4 text-center">
          <Globe className="w-6 h-6 text-green-400 mx-auto mb-1" />
          <p className="text-2xl font-display font-bold text-foreground">{onlineCount}</p>
          <p className="text-xs text-muted-foreground">Online Now</p>
        </div>
        <div className="gaming-card p-4 text-center">
          <Gamepad2 className="w-6 h-6 text-gaming-gold mx-auto mb-1" />
          <p className="text-2xl font-display font-bold text-foreground">{inGameCount}</p>
          <p className="text-xs text-muted-foreground">In Game</p>
        </div>
      </div>

      {/* Add Friend */}
      <div className="gaming-card p-6">
        <h3 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" /> Add Friend
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Enter username..." value={search}
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={handleAdd} className="px-4 py-2.5 gaming-gradient text-primary-foreground font-bold rounded-lg">Send</button>
        </div>
        {msg && <p className="mt-2 text-sm text-primary">{msg}</p>}
      </div>

      {/* Friend Requests */}
      {requests.length > 0 && (
        <div className="gaming-card p-6">
          <h3 className="font-display font-bold text-foreground mb-3">Friend Requests ({requests.length})</h3>
          <div className="space-y-2">
            {requests.map((from) => (
              <div key={from} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                <span className="font-medium text-foreground">{from}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(from)} className="p-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30"><Check className="w-4 h-4" /></button>
                  <button onClick={() => handleDecline(from)} className="p-2 bg-destructive/20 text-destructive rounded-lg hover:bg-destructive/30"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="gaming-card p-6">
        <h3 className="font-display font-bold text-foreground mb-3">Your Friends ({friends.length})</h3>
        {friends.length === 0 ? (
          <p className="text-muted-foreground text-sm">No friends yet. Send a request!</p>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => {
              const online = isFriendOnline(f);
              const gameInfo = getFriendGameInfo(f);
              return (
                <div key={f} className="flex items-center gap-3 bg-secondary rounded-lg px-4 py-3">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                      {f[0].toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-secondary ${online ? "bg-green-400" : "bg-muted-foreground/40"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{f}</span>
                    {gameInfo ? (
                      <p className="text-xs text-green-400">Playing: {gameInfo.gameName}</p>
                    ) : online ? (
                      <p className="text-xs text-muted-foreground">Online</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">Offline</p>
                    )}
                  </div>
                  {gameInfo && onJoinGame && (
                    <button onClick={() => onJoinGame(gameInfo.gameId)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs font-bold hover:bg-green-600/30">
                      <Play className="w-3 h-3" /> Join
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Friends;

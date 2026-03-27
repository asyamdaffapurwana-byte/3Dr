import { useState } from "react";
import { getPublishedGames, getMyGames, UserGame, deleteGame, getGameServers } from "@/lib/gameStore";
import { User } from "@/lib/store";
import { motion } from "framer-motion";
import { Play, Plus, Star, User as UserIcon, Trash2, Pencil, Users } from "lucide-react";

const GamesBrowser = ({
  user, onPlayGame, onCreateGame, onEditGame,
}: {
  user: User;
  onPlayGame: (game: UserGame) => void;
  onCreateGame: () => void;
  onEditGame?: (game: UserGame) => void;
}) => {
  const [tab, setTab] = useState<"discover" | "my">("discover");
  const [, forceUpdate] = useState(0);

  const published = getPublishedGames();
  const myGames = getMyGames(user.username);
  const games = tab === "discover" ? published : myGames;

  const handleDelete = (id: string) => { deleteGame(id); forceUpdate(n => n + 1); };

  const avgRating = (g: UserGame) =>
    g.ratings.length > 0 ? (g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length).toFixed(1) : "—";

  const getActivePlayers = (gameId: string) => {
    const servers = getGameServers(gameId);
    return servers.reduce((sum, s) => sum + s.players.length, 0);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-3xl font-display font-bold text-foreground">Games</h2>
        <button onClick={onCreateGame}
          className="flex items-center gap-2 px-4 py-2 gaming-gradient text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity">
          <Plus className="w-5 h-5" /> Create a Game
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("discover")}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${tab === "discover" ? "gaming-gradient text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          🌍 Discover
        </button>
        <button onClick={() => setTab("my")}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${tab === "my" ? "gaming-gradient text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          📁 My Games
        </button>
      </div>

      {games.length === 0 ? (
        <div className="gaming-card p-12 text-center">
          <p className="text-muted-foreground text-lg">
            {tab === "discover" ? "No published games yet. Be the first to create one!" : "You haven't created any games yet."}
          </p>
          <button onClick={onCreateGame} className="mt-4 px-6 py-3 gaming-gradient text-primary-foreground font-bold rounded-lg">
            Create Your First Game
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => {
            const activePlayers = getActivePlayers(game.id);
            return (
              <div key={game.id} className="gaming-card overflow-hidden group">
                <div className="h-36 bg-secondary flex items-center justify-center relative">
                  {game.image ? (
                    <img src={game.image} alt={game.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-4xl">🎮</div>
                  )}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => onPlayGame(game)}
                      className="px-5 py-2.5 gaming-gradient text-primary-foreground font-bold rounded-lg flex items-center gap-2">
                      <Play className="w-5 h-5" /> Play
                    </button>
                  </div>
                  {activePlayers > 0 && (
                    <div className="absolute top-2 right-2 bg-green-600/90 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                      <Users className="w-3 h-3" /> {activePlayers}
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-display font-bold text-foreground truncate">{game.name || "Untitled"}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{game.description || "No description"}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{game.creator}</span>
                    <span className="flex items-center gap-1"><Star className="w-3 h-3 text-gaming-gold" />{avgRating(game)}</span>
                    <span>▶ {game.plays}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/60">Max {game.maxPlayersPerServer || 10} per server</div>
                  {tab === "my" && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => onPlayGame(game)} className="flex-1 py-1.5 text-xs bg-primary/10 text-primary rounded font-bold">Play</button>
                      {onEditGame && (
                        <button onClick={() => onEditGame(game)} className="p-1.5 text-primary hover:bg-primary/10 rounded" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(game.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default GamesBrowser;

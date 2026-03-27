// Store for user-created games

export interface GameBlock {
  id: string;
  type: "block" | "sphere" | "cylinder" | "wedge" | "corner_wedge" | "truss" | "spawn" | "seat" | "mesh";
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation: [number, number, number];
}

export interface GameServer {
  id: string;
  gameId: string;
  players: string[]; // usernames
  maxPlayers: number;
  createdAt: number;
}

export interface UserGame {
  id: string;
  name: string;
  description: string;
  image: string;
  creator: string;
  blocks: GameBlock[];
  published: boolean;
  createdAt: number;
  updatedAt: number;
  plays: number;
  ratings: number[];
  maxPlayersPerServer: number;
}

const GAMES_KEY = "3dr_user_games";
const SERVERS_KEY = "3dr_game_servers";
const PLAYER_GAME_KEY = "3dr_player_current_game"; // username -> { gameId, serverId }

function getGames(): UserGame[] {
  const raw = localStorage.getItem(GAMES_KEY);
  const games: UserGame[] = raw ? JSON.parse(raw) : [];
  // migrate
  for (const g of games) {
    if (!g.maxPlayersPerServer) g.maxPlayersPerServer = 10;
  }
  return games;
}

function saveGames(games: UserGame[]) {
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

export function getAllGames(): UserGame[] { return getGames(); }
export function getPublishedGames(): UserGame[] { return getGames().filter(g => g.published); }
export function getMyGames(username: string): UserGame[] { return getGames().filter(g => g.creator === username); }
export function getGameById(id: string): UserGame | null { return getGames().find(g => g.id === id) || null; }

export function saveGame(game: UserGame): void {
  const games = getGames();
  const idx = games.findIndex(g => g.id === game.id);
  game.updatedAt = Date.now();
  if (!game.maxPlayersPerServer) game.maxPlayersPerServer = 10;
  if (idx >= 0) games[idx] = game; else games.push(game);
  saveGames(games);
}

export function deleteGame(id: string): void { saveGames(getGames().filter(g => g.id !== id)); }
export function incrementPlays(id: string): void {
  const games = getGames(); const g = games.find(g => g.id === id);
  if (g) { g.plays++; saveGames(games); }
}
export function rateGame(id: string, rating: number): void {
  const games = getGames(); const g = games.find(g => g.id === id);
  if (g) { g.ratings.push(rating); saveGames(games); }
}

export function createNewGame(creator: string): UserGame {
  return {
    id: `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "", description: "", image: "", creator,
    blocks: [{ id: "spawn_1", type: "spawn", position: [0, 0.5, 0], size: [4, 1, 4], color: "#4ade80", rotation: [0, 0, 0] }],
    published: false, createdAt: Date.now(), updatedAt: Date.now(), plays: 0, ratings: [],
    maxPlayersPerServer: 10,
  };
}

// ─── Server management ───
function getServers(): GameServer[] {
  const raw = localStorage.getItem(SERVERS_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveServers(servers: GameServer[]) {
  localStorage.setItem(SERVERS_KEY, JSON.stringify(servers));
}

export function getGameServers(gameId: string): GameServer[] {
  return getServers().filter(s => s.gameId === gameId);
}

export function joinGameServer(gameId: string, username: string): { server: GameServer; full: boolean; waitingCount?: number } {
  const servers = getServers();
  const game = getGameById(gameId);
  const maxPlayers = game?.maxPlayersPerServer || 10;

  // Find a server with space
  let available = servers.find(s => s.gameId === gameId && s.players.length < s.maxPlayers && !s.players.includes(username));
  if (available) {
    available.players.push(username);
    saveServers(servers);
    setPlayerCurrentGame(username, gameId, available.id);
    return { server: available, full: false };
  }

  // Check if all servers full
  const gameServers = servers.filter(s => s.gameId === gameId);
  if (gameServers.length > 0 && gameServers.every(s => s.players.length >= s.maxPlayers)) {
    // Find the one with fewest excess
    const smallest = gameServers.reduce((a, b) => a.players.length < b.players.length ? a : b);
    return { server: smallest, full: true, waitingCount: 1 };
  }

  // Create new server
  const newServer: GameServer = {
    id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    gameId, players: [username], maxPlayers, createdAt: Date.now(),
  };
  servers.push(newServer);
  saveServers(servers);
  setPlayerCurrentGame(username, gameId, newServer.id);
  return { server: newServer, full: false };
}

export function leaveGameServer(username: string) {
  const servers = getServers();
  for (const s of servers) {
    s.players = s.players.filter(p => p !== username);
  }
  // Remove empty servers
  saveServers(servers.filter(s => s.players.length > 0));
  clearPlayerCurrentGame(username);
}

// Track what game a player is in
function setPlayerCurrentGame(username: string, gameId: string, serverId: string) {
  const data = getPlayerGames();
  data[username] = { gameId, serverId, joinedAt: Date.now() };
  localStorage.setItem(PLAYER_GAME_KEY, JSON.stringify(data));
}

function clearPlayerCurrentGame(username: string) {
  const data = getPlayerGames();
  delete data[username];
  localStorage.setItem(PLAYER_GAME_KEY, JSON.stringify(data));
}

function getPlayerGames(): Record<string, { gameId: string; serverId: string; joinedAt: number }> {
  const raw = localStorage.getItem(PLAYER_GAME_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function getPlayerCurrentGame(username: string): { gameId: string; serverId: string } | null {
  const data = getPlayerGames();
  return data[username] || null;
}

export const BLOCK_TYPES: { type: GameBlock["type"]; name: string; emoji: string; description: string }[] = [
  { type: "block", name: "Block", emoji: "🧱", description: "Default rectangular brick" },
  { type: "sphere", name: "Sphere", emoji: "⚽", description: "Ball / round shape" },
  { type: "cylinder", name: "Cylinder", emoji: "🪵", description: "Tube / round log" },
  { type: "wedge", name: "Wedge", emoji: "📐", description: "Triangular ramp" },
  { type: "corner_wedge", name: "Corner Wedge", emoji: "📏", description: "Corner triangle ramp" },
  { type: "truss", name: "TrussPart", emoji: "🪜", description: "Climbable lattice" },
  { type: "spawn", name: "SpawnLocation", emoji: "🟢", description: "Player spawn point" },
  { type: "seat", name: "Seat", emoji: "🪑", description: "Sittable block" },
  { type: "mesh", name: "MeshPart", emoji: "🔷", description: "Custom 3D shape" },
];

export const BLOCK_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#06b6d4", "#ffffff", "#6b7280",
  "#1e1e2e", "#92400e", "#14b8a6", "#f43f5e", "#d97706",
];

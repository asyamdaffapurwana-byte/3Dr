// Simple localStorage-based store for 3Dr

export interface User {
  username: string;
  password: string;
  points: number;
  avatar: string;
  hat: string;
  pants: string;
  accessories: string;
  clothes: string;
  feet: string;
  hands: string;
  style: string;
  friends: string[];
  friendRequests: string[];
  lastDailyReward: string;
  isOwner: boolean;
  title: string;
  id: number;
  lastOnline: number;
  inGame: boolean;
}

export interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
  isGlobal?: boolean;
}

export interface ModerationAction {
  type: "kick" | "ban";
  target: string;
  reason: string;
  by: string;
  createdAt: number;
  durationMs?: number;
  expiresAt?: number;
}

const USERS_KEY = "3dr_users";
const CURRENT_USER_KEY = "3dr_current_user";
const CHAT_KEY = "3dr_chat";
const RATINGS_KEY = "3dr_ratings";
const MODERATION_KEY = "3dr_moderation";
const NEXT_ID_KEY = "3dr_next_id";

function getNextId(): number {
  const raw = localStorage.getItem(NEXT_ID_KEY);
  return raw ? parseInt(raw) : 1;
}

function incrementNextId(): number {
  const id = getNextId();
  localStorage.setItem(NEXT_ID_KEY, String(id + 1));
  return id;
}

function getUsers(): Record<string, User> {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) {
    const owner: User = {
      username: "3Dr",
      password: "Asyamdaffa_1234",
      points: 10000000,
      avatar: "default",
      hat: "crown",
      pants: "default",
      accessories: "none",
      clothes: "default",
      feet: "default",
      hands: "default",
      style: "legendary",
      friends: [],
      friendRequests: [],
      lastDailyReward: new Date().toISOString(),
      isOwner: true,
      title: "Admin",
      id: incrementNextId(),
      lastOnline: Date.now(),
      inGame: false,
    };
    const users = { "3Dr": owner };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return users;
  }
  const users = JSON.parse(raw);
  // Migrate old users missing new fields
  for (const u of Object.values(users) as User[]) {
    if (!u.pants) u.pants = "default";
    if (!u.accessories) u.accessories = "none";
    if (!u.clothes) u.clothes = "default";
    if (!u.feet) u.feet = "default";
    if (!u.hands) u.hands = "default";
    if (!u.id) u.id = incrementNextId();
    if (!u.lastOnline) u.lastOnline = Date.now();
    if (u.inGame === undefined) u.inGame = false;
  }
  return users;
}

function saveUsers(users: Record<string, User>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function signup(username: string, password: string): { success: boolean; error?: string } {
  const users = getUsers();
  if (users[username]) return { success: false, error: "Username already taken" };
  if (username.length < 2) return { success: false, error: "Username too short" };
  if (password.length < 4) return { success: false, error: "Password too short" };

  users[username] = {
    username,
    password,
    points: 100,
    avatar: "default",
    hat: "none",
    pants: "default",
    accessories: "none",
    clothes: "default",
    feet: "default",
    hands: "default",
    style: "default",
    friends: [],
    friendRequests: [],
    lastDailyReward: "",
    isOwner: false,
    title: "",
    id: incrementNextId(),
    lastOnline: Date.now(),
    inGame: false,
  };
  saveUsers(users);
  localStorage.setItem(CURRENT_USER_KEY, username);
  return { success: true };
}

export function login(username: string, password: string): { success: boolean; error?: string } {
  const users = getUsers();
  const user = users[username];
  if (!user) return { success: false, error: "User not found" };
  if (user.password !== password) return { success: false, error: "Incorrect password" };
  user.lastOnline = Date.now();
  saveUsers(users);
  localStorage.setItem(CURRENT_USER_KEY, username);
  return { success: true };
}

export function logout() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function getCurrentUser(): User | null {
  const username = localStorage.getItem(CURRENT_USER_KEY);
  if (!username) return null;
  const users = getUsers();
  return users[username] || null;
}

export function updateUser(updates: Partial<User>) {
  const username = localStorage.getItem(CURRENT_USER_KEY);
  if (!username) return;
  const users = getUsers();
  if (!users[username]) return;
  users[username] = { ...users[username], ...updates };
  saveUsers(users);
}

export function claimDailyReward(): { success: boolean; amount: number } {
  const user = getCurrentUser();
  if (!user) return { success: false, amount: 0 };
  const now = new Date();
  const last = user.lastDailyReward ? new Date(user.lastDailyReward) : null;
  if (last && now.getTime() - last.getTime() < 24 * 60 * 60 * 1000) {
    return { success: false, amount: 0 };
  }
  const amount = user.isOwner ? 10000000 : 10;
  updateUser({ points: user.points + amount, lastDailyReward: now.toISOString() });
  return { success: true, amount };
}

export function sendFriendRequest(toUsername: string): { success: boolean; error?: string } {
  const user = getCurrentUser();
  if (!user) return { success: false, error: "Not logged in" };
  const users = getUsers();
  const target = users[toUsername];
  if (!target) return { success: false, error: "User not found" };
  if (toUsername === user.username) return { success: false, error: "Can't add yourself" };
  if (user.friends.includes(toUsername)) return { success: false, error: "Already friends" };
  if (target.friendRequests.includes(user.username)) return { success: false, error: "Request already sent" };
  target.friendRequests.push(user.username);
  saveUsers(users);
  return { success: true };
}

export function acceptFriend(fromUsername: string) {
  const user = getCurrentUser();
  if (!user) return;
  const users = getUsers();
  const me = users[user.username];
  const them = users[fromUsername];
  if (!me || !them) return;
  me.friendRequests = me.friendRequests.filter((u) => u !== fromUsername);
  me.friends.push(fromUsername);
  them.friends.push(user.username);
  saveUsers(users);
}

export function declineFriend(fromUsername: string) {
  const user = getCurrentUser();
  if (!user) return;
  const users = getUsers();
  users[user.username].friendRequests = users[user.username].friendRequests.filter((u) => u !== fromUsername);
  saveUsers(users);
}

// ─── Moderation ───
function getModerationState(): Record<string, ModerationAction> {
  const raw = localStorage.getItem(MODERATION_KEY);
  if (!raw) return {};
  return JSON.parse(raw);
}

function saveModerationState(state: Record<string, ModerationAction>) {
  localStorage.setItem(MODERATION_KEY, JSON.stringify(state));
}

function clearExpiredModeration(state: Record<string, ModerationAction>) {
  const now = Date.now();
  for (const username of Object.keys(state)) {
    const action = state[username];
    if (action.type === "ban" && action.expiresAt && action.expiresAt <= now) {
      delete state[username];
    }
  }
}

export function kickUser(targetUsername: string, reason: string, by: string): { success: boolean; error?: string } {
  const users = getUsers();
  if (!users[targetUsername]) return { success: false, error: "Target user not found" };
  const state = getModerationState();
  state[targetUsername] = { type: "kick", target: targetUsername, reason, by, createdAt: Date.now() };
  saveModerationState(state);
  return { success: true };
}

export function banUser(targetUsername: string, reason: string, by: string, durationMs: number): { success: boolean; error?: string } {
  if (durationMs <= 0) return { success: false, error: "Duration must be greater than 0" };
  const users = getUsers();
  if (!users[targetUsername]) return { success: false, error: "Target user not found" };
  const createdAt = Date.now();
  const state = getModerationState();
  state[targetUsername] = { type: "ban", target: targetUsername, reason, by, createdAt, durationMs, expiresAt: createdAt + durationMs };
  saveModerationState(state);
  return { success: true };
}

export function getActiveModerationForCurrentUser(): ModerationAction | null {
  const user = getCurrentUser();
  if (!user) return null;
  const state = getModerationState();
  clearExpiredModeration(state);
  saveModerationState(state);
  return state[user.username] || null;
}

export function dismissCurrentModeration() {
  const user = getCurrentUser();
  if (!user) return;
  const state = getModerationState();
  const action = state[user.username];
  if (!action) return;
  if (action.type === "kick") { delete state[user.username]; saveModerationState(state); }
}

// ─── Chat ───
export function getChatMessages(): ChatMessage[] {
  const raw = localStorage.getItem(CHAT_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function sendChatMessage(text: string, isGlobal = false) {
  const user = getCurrentUser();
  if (!user) return;
  const msgs = getChatMessages();
  msgs.push({ from: user.username, text, timestamp: Date.now(), isGlobal });
  if (msgs.length > 100) msgs.splice(0, msgs.length - 100);
  localStorage.setItem(CHAT_KEY, JSON.stringify(msgs));
}

// ─── Ratings ───
export function getRatings(): number[] {
  const raw = localStorage.getItem(RATINGS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function addRating(rating: number) {
  const ratings = getRatings();
  ratings.push(rating);
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
}

// ─── Avatar items ───
export const AVATARS = [
  { id: "default", name: "Classic", price: 0, color: "#3ecf8e" },
  { id: "blue", name: "Ocean", price: 0, color: "#3b82f6" },
  { id: "red", name: "Blaze", price: 0, color: "#ef4444" },
  { id: "gold", name: "Golden", price: 50, color: "#eab308" },
  { id: "purple", name: "Mystic", price: 100, color: "#a855f7" },
  { id: "rainbow", name: "Rainbow", price: 200, color: "#ec4899" },
  { id: "diamond", name: "Diamond", price: 500, color: "#06b6d4" },
  { id: "shadow", name: "Shadow", price: 1000, color: "#1e1e2e" },
];

export const AVATAR_HATS = [
  { id: "none", name: "None", price: 0, emoji: "❌" },
  { id: "cap", name: "Baseball Cap", price: 0, emoji: "🧢" },
  { id: "tophat", name: "Top Hat", price: 50, emoji: "🎩" },
  { id: "crown", name: "Crown", price: 200, emoji: "👑" },
  { id: "halo", name: "Halo", price: 500, emoji: "😇" },
  { id: "horns", name: "Devil Horns", price: 300, emoji: "😈" },
  { id: "beanie", name: "Beanie", price: 30, emoji: "🧶" },
  { id: "helmet", name: "Helmet", price: 150, emoji: "⛑️" },
];

export const AVATAR_PANTS = [
  { id: "default", name: "Basic Pants", price: 0, emoji: "👖" },
  { id: "jeans", name: "Jeans", price: 20, emoji: "👖" },
  { id: "shorts", name: "Shorts", price: 15, emoji: "🩳" },
  { id: "cargo", name: "Cargo Pants", price: 40, emoji: "👖" },
  { id: "suit", name: "Suit Pants", price: 80, emoji: "🩳" },
  { id: "golden", name: "Golden Pants", price: 300, emoji: "✨" },
];

export const AVATAR_ACCESSORIES = [
  { id: "none", name: "None", price: 0, emoji: "❌" },
  { id: "glasses", name: "Glasses", price: 25, emoji: "👓" },
  { id: "sunglasses", name: "Sunglasses", price: 40, emoji: "🕶️" },
  { id: "necklace", name: "Necklace", price: 60, emoji: "📿" },
  { id: "watch", name: "Watch", price: 50, emoji: "⌚" },
  { id: "diamond", name: "Diamond Chain", price: 500, emoji: "💎" },
];

export const AVATAR_CLOTHES = [
  { id: "default", name: "Basic Shirt", price: 0, emoji: "👕" },
  { id: "hoodie", name: "Hoodie", price: 30, emoji: "🧥" },
  { id: "jacket", name: "Jacket", price: 50, emoji: "🧥" },
  { id: "suit", name: "Suit", price: 100, emoji: "🤵" },
  { id: "armor", name: "Armor", price: 250, emoji: "🛡️" },
  { id: "legendary", name: "Legendary Robe", price: 500, emoji: "✨" },
];

export const AVATAR_FEET = [
  { id: "default", name: "Basic Shoes", price: 0, emoji: "👟" },
  { id: "sneakers", name: "Sneakers", price: 25, emoji: "👟" },
  { id: "boots", name: "Boots", price: 40, emoji: "🥾" },
  { id: "sandals", name: "Sandals", price: 15, emoji: "🩴" },
  { id: "golden", name: "Golden Shoes", price: 300, emoji: "✨" },
];

export const AVATAR_HANDS = [
  { id: "default", name: "None", price: 0, emoji: "✋" },
  { id: "gloves", name: "Gloves", price: 20, emoji: "🧤" },
  { id: "boxing", name: "Boxing Gloves", price: 50, emoji: "🥊" },
  { id: "rings", name: "Rings", price: 80, emoji: "💍" },
  { id: "golden", name: "Golden Gauntlets", price: 400, emoji: "✨" },
];

// Keep old exports for backward compat
export const HATS = AVATAR_HATS;
export const STYLES = [
  { id: "default", name: "Default", price: 0 },
  { id: "sporty", name: "Sporty", price: 30 },
  { id: "fancy", name: "Fancy", price: 80 },
  { id: "ninja", name: "Ninja", price: 150 },
  { id: "legendary", name: "Legendary", price: 500 },
];

export const POINT_PACKS = [
  { id: "small", name: "Small Pack", points: 100, price: "$0.99" },
  { id: "medium", name: "Medium Pack", points: 500, price: "$3.99" },
  { id: "large", name: "Large Pack", points: 1200, price: "$7.99" },
  { id: "mega", name: "Mega Pack", points: 5000, price: "$24.99" },
];

// ─── Player stats ───
export function getAllUsers(): User[] {
  return Object.values(getUsers());
}

export function getTotalUsers(): number {
  return Object.keys(getUsers()).length;
}

export function getOnlineUsers(): User[] {
  const users = getUsers();
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  return Object.values(users).filter(u => u.lastOnline > fiveMinAgo);
}

export function getInGameUsers(): User[] {
  return Object.values(getUsers()).filter(u => u.inGame);
}

export function setInGame(inGame: boolean) {
  const username = localStorage.getItem(CURRENT_USER_KEY);
  if (!username) return;
  const users = getUsers();
  if (!users[username]) return;
  users[username].inGame = inGame;
  users[username].lastOnline = Date.now();
  saveUsers(users);
}

export function heartbeat() {
  const username = localStorage.getItem(CURRENT_USER_KEY);
  if (!username) return;
  const users = getUsers();
  if (!users[username]) return;
  users[username].lastOnline = Date.now();
  saveUsers(users);
}

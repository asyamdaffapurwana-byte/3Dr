import { useState } from "react";
import { User, AVATAR_HATS, AVATAR_PANTS, AVATAR_ACCESSORIES, AVATAR_CLOTHES, AVATAR_FEET, AVATAR_HANDS, updateUser, getCurrentUser } from "@/lib/store";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";

type TabId = "hat" | "pants" | "accessories" | "clothes" | "feet" | "hands";

const TABS: { id: TabId; label: string }[] = [
  { id: "hat", label: "🎩 Hat" },
  { id: "pants", label: "👖 Pants" },
  { id: "accessories", label: "💎 Accessories" },
  { id: "clothes", label: "👕 Clothes" },
  { id: "feet", label: "👟 Feet" },
  { id: "hands", label: "🧤 Hands" },
];

const ITEMS_MAP: Record<TabId, { id: string; name: string; price: number; emoji: string }[]> = {
  hat: AVATAR_HATS,
  pants: AVATAR_PANTS,
  accessories: AVATAR_ACCESSORIES,
  clothes: AVATAR_CLOTHES,
  feet: AVATAR_FEET,
  hands: AVATAR_HANDS,
};

const USER_KEY_MAP: Record<TabId, keyof User> = {
  hat: "hat",
  pants: "pants",
  accessories: "accessories",
  clothes: "clothes",
  feet: "feet",
  hands: "hands",
};

const AvatarCustomizer = ({ user, refreshUser }: { user: User; refreshUser: () => void }) => {
  const [tab, setTab] = useState<TabId>("hat");
  const [msg, setMsg] = useState("");

  const fresh = getCurrentUser() || user;
  const items = ITEMS_MAP[tab];
  const currentId = (fresh as any)[USER_KEY_MAP[tab]] || items[0]?.id;

  const buyAndEquip = (id: string, price: number) => {
    if (price > 0 && fresh.points < price) {
      setMsg("Not enough Points!");
      setTimeout(() => setMsg(""), 2000);
      return;
    }
    const updates: Partial<User> = {};
    if (price > 0) updates.points = fresh.points - price;
    (updates as any)[USER_KEY_MAP[tab]] = id;
    updateUser(updates);
    refreshUser();
    setMsg(price > 0 ? "Purchased and equipped!" : "Equipped!");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-3xl font-display font-bold text-foreground">Customize Avatar</h2>

      {msg && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-primary/10 border border-primary/30 text-primary px-4 py-2 rounded-lg text-center font-bold text-sm">
          {msg}
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              tab === t.id ? "gaming-gradient text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => {
          const isEquipped = item.id === currentId;
          const canAfford = item.price === 0 || fresh.points >= item.price;

          return (
            <button
              key={item.id}
              onClick={() => buyAndEquip(item.id, isEquipped ? 0 : item.price)}
              className={`gaming-card p-4 flex flex-col items-center gap-2 relative ${isEquipped ? "border-primary" : ""}`}
            >
              {isEquipped && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <div className="text-3xl">{item.emoji}</div>
              <span className="text-sm font-bold text-foreground">{item.name}</span>
              {item.price > 0 ? (
                <span className={`text-xs font-bold ${canAfford ? "text-gaming-gold" : "text-muted-foreground"}`}>
                  {canAfford ? `${item.price} pts` : <span className="flex items-center gap-1"><Lock className="w-3 h-3" />{item.price} pts</span>}
                </span>
              ) : (
                <span className="text-xs text-primary font-bold">Free</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center text-muted-foreground text-xs">Made by 3Dr</p>
    </motion.div>
  );
};

export default AvatarCustomizer;

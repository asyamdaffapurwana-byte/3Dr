import { User, POINT_PACKS, updateUser } from "@/lib/store";
import { motion } from "framer-motion";
import { ShoppingBag, Star, Zap } from "lucide-react";
import { useState } from "react";

const Shop = ({ user, refreshUser }: { user: User; refreshUser: () => void }) => {
  const [purchased, setPurchased] = useState("");

  const handleBuy = (pack: typeof POINT_PACKS[0]) => {
    // Simulate purchase — in real app this would go to payment
    updateUser({ points: user.points + pack.points });
    refreshUser();
    setPurchased(`You got ${pack.points} Points!`);
    setTimeout(() => setPurchased(""), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-display font-bold text-foreground">Shop</h2>
        <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-lg">
          <Star className="w-5 h-5 text-gaming-gold" />
          <span className="font-bold text-foreground">{user.points.toLocaleString()} Points</span>
        </div>
      </div>

      {purchased && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-primary/10 border border-primary/30 text-primary px-4 py-3 rounded-lg font-bold text-center">
          {purchased}
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {POINT_PACKS.map((pack, i) => (
          <motion.div
            key={pack.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`gaming-card p-6 flex flex-col items-center gap-3 ${i === POINT_PACKS.length - 1 ? "border-gaming-gold/40 sm:col-span-2" : ""}`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${i === POINT_PACKS.length - 1 ? "gold-gradient" : "gaming-gradient"}`}>
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <h3 className="font-display font-bold text-lg text-foreground">{pack.name}</h3>
            <p className="text-gaming-gold font-bold text-2xl">{pack.points.toLocaleString()} Points</p>
            <button
              onClick={() => handleBuy(pack)}
              className="w-full py-2.5 gaming-gradient text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              {pack.price}
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default Shop;

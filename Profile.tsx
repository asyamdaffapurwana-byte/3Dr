import { User, AVATARS } from "@/lib/store";
import { motion } from "framer-motion";
import { Star, Users, Trophy } from "lucide-react";

const Profile = ({ user }: { user: User }) => {
  const avatar = AVATARS.find((a) => a.id === user.avatar) || AVATARS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <h2 className="text-3xl font-display font-bold text-foreground">Profile</h2>

      <div className="gaming-card p-8 flex flex-col items-center gap-4">
        {/* Avatar */}
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-display font-bold text-primary-foreground"
          style={{ backgroundColor: avatar.color }}
        >
          {user.username[0].toUpperCase()}
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-display font-bold text-foreground flex items-center gap-2 justify-center">
            {user.username}
            {user.isOwner && (
              <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-md font-bold">
                {user.title || "Admin"}
              </span>
            )}
          </h3>
          <p className="text-muted-foreground capitalize">
            Avatar: {avatar.name} • Hat: {user.hat} • Style: {user.style}
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">
            https://3Dr.user/Id/{user.id || 1}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="gaming-card p-6 text-center">
          <Star className="w-8 h-8 text-gaming-gold mx-auto mb-2" />
          <p className="text-2xl font-display font-bold text-foreground">{user.points.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Points</p>
        </div>
        <div className="gaming-card p-6 text-center">
          <Users className="w-8 h-8 text-gaming-blue mx-auto mb-2" />
          <p className="text-2xl font-display font-bold text-foreground">{user.friends.length}</p>
          <p className="text-sm text-muted-foreground">Friends</p>
        </div>
        <div className="gaming-card p-6 text-center">
          <Trophy className="w-8 h-8 text-gaming-purple mx-auto mb-2" />
          <p className="text-2xl font-display font-bold text-foreground">0</p>
          <p className="text-sm text-muted-foreground">Games Played</p>
        </div>
      </div>
    </motion.div>
  );
};

export default Profile;

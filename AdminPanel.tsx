import { useState } from "react";
import { User, sendChatMessage, kickUser, banUser } from "@/lib/store";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const durationUnits: Record<string, number> = {
  minute: 60 * 1000,
  minutes: 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
  years: 365 * 24 * 60 * 60 * 1000,
};

const AdminPanel = ({ user, refreshUser }: { user: User; refreshUser: () => void }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [cmd, setCmd] = useState("");
  const [output, setOutput] = useState("");

  const executeCmd = () => {
    const parts = cmd.trim().split(" ");
    const action = parts[0]?.toLowerCase();

    if (action === "m" || action === "mglobal") {
      const message = parts.slice(1).join(" ");
      if (message) {
        sendChatMessage(`[ADMIN] ${message}`, action === "mglobal");
        setOutput(`Message sent: "${message}"${action === "mglobal" ? " (Global)" : ""}`);
      }
    } else if (action === "globalall") {
      const message = parts.slice(1).join(" ");
      sendChatMessage(`[GLOBAL ADMIN] ${message}`, true);
      setOutput(`Global message sent to all: "${message}"`);
    } else if (action === "size") {
      const size = parts[1];
      const target = parts[2] || "user";
      setOutput(`Size set to ${size} for ${target}`);
    } else if (action === "chat") {
      const mode = parts[1]?.toLowerCase();
      setOutput(`Chat mode: ${mode || "toggled"}`);
    } else if (action === "title") {
      const title = parts.slice(1).join(" ");
      setOutput(`Title set to: "${title}"`);
    } else if (action === "kick") {
      const target = parts[1];
      const reason = parts.slice(2).join(" ") || "No reason provided";
      if (!target) {
        setOutput("Usage: kick [username] [reason]");
      } else {
        const result = kickUser(target, reason, user.username);
        setOutput(result.success ? `Kicked ${target}` : result.error || "Failed to kick user");
      }
    } else if (action === "ban") {
      const target = parts[1];
      const amount = Number(parts[2]);
      const unit = parts[3]?.toLowerCase();
      const reason = parts.slice(4).join(" ") || "No reason provided";

      if (!target || !amount || !unit) {
        setOutput("Usage: ban [username] [number] [minutes|hours|weeks|years] [reason]");
      } else if (!durationUnits[unit]) {
        setOutput("Unit must be: minutes, hours, weeks, years");
      } else {
        const durationMs = amount * durationUnits[unit];
        const result = banUser(target, reason, user.username, durationMs);
        setOutput(result.success ? `Banned ${target} for ${amount} ${unit}` : result.error || "Failed to ban user");
      }
    } else {
      setOutput(`Commands: m, mglobal, globalall, size, chat, title, kick, ban`);
    }

    refreshUser();
    setCmd("");
    setTimeout(() => setOutput(""), 3000);
  };

  if (!user.isOwner) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="gaming-card p-4 w-full flex items-center gap-3 border-destructive/30"
      >
        <Shield className="w-6 h-6 text-destructive" />
        <span className="font-display font-bold text-foreground">Admin</span>
      </button>

      {showPanel && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="gaming-card p-6 space-y-4 border-destructive/20">
          <h3 className="font-display font-bold text-foreground">Admin Commands</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="bg-secondary p-2 rounded"><code>m [message]</code> — Send message</div>
            <div className="bg-secondary p-2 rounded"><code>mglobal [msg]</code> — Global message</div>
            <div className="bg-secondary p-2 rounded"><code>globalall [msg]</code> — All servers</div>
            <div className="bg-secondary p-2 rounded"><code>size [n] [target]</code> — Set size</div>
            <div className="bg-secondary p-2 rounded"><code>chat [mode]</code> — Chat control</div>
            <div className="bg-secondary p-2 rounded"><code>title [text]</code> — Set title</div>
            <div className="bg-secondary p-2 rounded"><code>kick [user] [reason]</code> — Kick user</div>
            <div className="bg-secondary p-2 rounded"><code>ban [user] [n] [unit] [reason]</code> — Ban user</div>
          </div>

          <div className="flex gap-2">
            <input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeCmd()}
              placeholder="Enter command..."
              className="flex-1 px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 text-sm"
            />
            <button onClick={executeCmd} className="px-4 py-2 bg-destructive text-destructive-foreground font-bold rounded-lg text-sm">
              Run
            </button>
          </div>
          {output && <p className="text-sm text-primary bg-primary/10 p-2 rounded">{output}</p>}
        </motion.div>
      )}
    </div>
  );
};

export default AdminPanel;

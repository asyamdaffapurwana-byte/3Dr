import { useState } from "react";
import { getCurrentUser } from "@/lib/store";
import Auth from "@/pages/Auth";
import Lobby from "@/pages/Lobby";

const Index = () => {
  const [isAuthed, setIsAuthed] = useState(() => !!getCurrentUser());

  if (!isAuthed) {
    return <Auth onAuth={() => setIsAuthed(true)} />;
  }

  return <Lobby onLogout={() => setIsAuthed(false)} />;
};

export default Index;

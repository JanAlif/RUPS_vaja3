import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { startRups2, stopRups2 } from "../rups2/main";

export default function Elektro() {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    // ✅ bridge: Phaser bere te ključe
    if (user) {
      localStorage.setItem("wpg_user", JSON.stringify(user));
      // če imaš avatarPath v userju:
      // localStorage.setItem("wpg_avatarPath", user.avatarPath || "");
    }

    gameRef.current = startRups2(hostRef.current);

    return () => {
      stopRups2(gameRef.current);
      gameRef.current = null;
    };
  }, [user]);

  return (
    <div style={{ width: "100%", height: "calc(100vh - 64px)" }}>
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
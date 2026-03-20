import { useCallback, useRef, useEffect } from "react";

export const useSound = (
  soundFile = "/assets/click-sound-1.wav",
  volume = 0.3
) => {
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio(soundFile);
    audioRef.current.volume = volume;
    audioRef.current.preload = "auto";
  }, [soundFile, volume]);

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log("Sound play failed:", err);
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const setVolume = useCallback((newVolume) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, newVolume));
    }
  }, []);

  return { play, stop, setVolume };
};

export default useSound;

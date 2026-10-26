import { useEffect, useRef } from "react";
// Preserve each list position; opening another memo starts at its own position.
export function useScreenScroll(key: string) {
  const positions = useRef(new Map<string, number>());
  useEffect(() => {
    let restoring = true;
    const record = () => {
      if (!restoring && document.body.dataset.scrollLock === undefined)
        positions.current.set(key, window.scrollY);
    };
    const frame = requestAnimationFrame(() => {
      window.scrollTo({
        top: positions.current.get(key) || 0,
        behavior: "instant",
      });
      restoring = false;
    });
    window.addEventListener("scroll", record, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", record);
    };
  }, [key]);
}

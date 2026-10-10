import { useEffect, useState } from "react";

export function useVisualViewport() {
  const [inset, setInset] = useState(0);
  const [height, setHeight] = useState(
    typeof window === "undefined" ? 800 : window.innerHeight,
  );

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      if (!vv) {
        setHeight(window.innerHeight);
        setInset(0);
        return;
      }
      setHeight(vv.height);
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return { inset, height };
}

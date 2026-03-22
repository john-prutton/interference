import { useState, useEffect, useCallback } from "react";

export function usePointerLock() {
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsLocked(document.pointerLockElement === document.body);
    };
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  const requestLock = useCallback(() => {
    document.body.requestPointerLock();
  }, []);

  return { isLocked, requestLock };
}

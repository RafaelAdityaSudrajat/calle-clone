import { useCallback, useEffect, useRef } from "react";

export const useDebouncedCallback = <A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
) => {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Selalu pakai versi fn terbaru; ref hanya disentuh di dalam effect.
  useEffect(() => {
    fnRef.current = fn;
  });

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
  }, []);

  const run = useCallback(
    (...args: A) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );

  // Batalkan timer yang masih menunggu saat komponen di-unmount.
  useEffect(() => cancel, [cancel]);

  return { run, cancel };
};
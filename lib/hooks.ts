"use client";

import { useEffect, useRef, useState } from "react";

/** Accumulate a rolling window of a value (one sample per second). */
export function useSeries(value: number, size = 40): number[] {
  const [series, setSeries] = useState<number[]>(() => Array.from({ length: 1 }, () => value));
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    const id = setInterval(() => {
      setSeries((prev) => [...prev, latest.current].slice(-size));
    }, 1000);
    return () => clearInterval(id);
  }, [size]);

  return series;
}

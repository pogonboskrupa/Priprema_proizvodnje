"use client";
import { useEffect, useState } from "react";
import { getNetState, onNetState, type NetState } from "@/lib/netStatus";

export function useNetStatus(): NetState {
  const [state, setState] = useState<NetState>(getNetState);
  useEffect(() => {
    setState(getNetState());
    return onNetState(setState);
  }, []);
  return state;
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { pratiZakljucavanje } from "@/lib/db";
import { jeZakljucan, prviOtkljucaniDan, type ZakljucanoDo } from "@/lib/zakljucavanje";

/** Zaključani mjeseci za trenutnog korisnika — admin ih može mijenjati, pa za njega ništa nije zaključano */
export function useZakljucavanje() {
  const { session } = useAuth();
  const [zakljucanoDo, setZakljucanoDo] = useState<ZakljucanoDo>(null);
  useEffect(() => pratiZakljucavanje(setZakljucanoDo), []);

  const admin = session?.role === "admin";
  const zakljucan = useCallback((datum: string) => !admin && jeZakljucan(datum, zakljucanoDo), [admin, zakljucanoDo]);
  return { zakljucanoDo, zakljucan, minDatum: admin ? null : prviOtkljucaniDan(zakljucanoDo) };
}

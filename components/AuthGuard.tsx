"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    if (!loading && !session) {
      router.replace(base + "/login/");
    }
  }, [session, loading]);

  if (loading || !session) return null;
  return <>{children}</>;
}

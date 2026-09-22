"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InzinjeriPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/postavke"); }, []);
  return null;
}

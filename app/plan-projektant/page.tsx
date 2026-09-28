"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlanProjektantRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/realizacija"); }, []);
  return null;
}

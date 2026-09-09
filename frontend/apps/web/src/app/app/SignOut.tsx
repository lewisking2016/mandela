"use client";

import { useRouter } from "next/navigation";
import { Button } from "@mandela/ui";

export function SignOut() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await fetch("/api/auth", { method: "DELETE" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}

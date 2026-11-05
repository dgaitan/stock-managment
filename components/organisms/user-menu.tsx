import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function UserMenu({ email }: { email: string }) {
  return (
    <form action={logout} className="flex items-center gap-2">
      <span
        title={email}
        className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      >
        {email.slice(0, 2).toUpperCase()}
      </span>
      <Button type="submit" variant="ghost" size="sm">
        Salir
      </Button>
    </form>
  );
}

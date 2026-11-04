import { logout } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function UserMenu({ email }: { email: string }) {
  return (
    <form action={logout} className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
      <Button type="submit" variant="ghost" size="sm">
        Salir
      </Button>
    </form>
  );
}

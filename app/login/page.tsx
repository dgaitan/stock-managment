import { LoginForm } from "@/components/organisms/login-form";

export const metadata = { title: "Ingresar · Pedido Inteligente" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <LoginForm />
    </main>
  );
}

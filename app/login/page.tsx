import { BrandMark } from "@/components/molecules/brand-mark";
import { LoginForm } from "@/components/organisms/login-form";

export const metadata = { title: "Ingresar · Pedido Inteligente" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-subtle p-6">
      <div className="flex w-[400px] max-w-full flex-col items-center gap-6">
        <BrandMark size="login" />
        <LoginForm />
        <p className="text-xs text-muted-foreground">Datos ficticios — prueba técnica</p>
      </div>
    </main>
  );
}

import { unsealData } from "iron-session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, type SessionData, sessionOptions } from "@/lib/auth/session-options";

// Primera barrera: redirige a /login si no hay sesión válida. Las acciones y
// páginas vuelven a verificarla con requireSession().
export async function proxy(request: NextRequest) {
  const sealed = request.cookies.get(SESSION_COOKIE)?.value;
  let email: string | undefined;
  if (sealed) {
    try {
      email = (await unsealData<SessionData>(sealed, sessionOptions())).email;
    } catch {
      email = undefined;
    }
  }
  const onLogin = request.nextUrl.pathname === "/login";
  if (!email && !onLogin) return NextResponse.redirect(new URL("/login", request.url));
  if (email && onLogin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

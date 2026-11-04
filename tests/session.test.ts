import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn() }));

import { credentialsMatch } from "@/lib/auth/session";

describe("credentialsMatch", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", "Planificador@Demo.local");
    vi.stubEnv("ADMIN_PASSWORD", "clave-de-prueba");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("acepta el usuario demo sin distinguir mayúsculas en el correo", () => {
    expect(credentialsMatch(" planificador@demo.local ", "clave-de-prueba")).toBe(true);
  });
  it("rechaza contraseña o correo incorrectos", () => {
    expect(credentialsMatch("planificador@demo.local", "otra")).toBe(false);
    expect(credentialsMatch("otro@demo.local", "clave-de-prueba")).toBe(false);
  });
  it("rechaza todo si las variables de entorno no están", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(credentialsMatch("planificador@demo.local", "")).toBe(false);
  });
});

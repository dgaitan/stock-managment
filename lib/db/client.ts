import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Un solo driver (postgres-js) habla el protocolo estandar de Postgres, asi que
// sirve igual contra el Postgres local de docker-compose y contra el connection
// string de Neon en Vercel. Solo cambia DATABASE_URL por entorno.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no esta configurado (ver .env.example)");
}

const client = postgres(connectionString, { max: 1 });

export const db = drizzle(client, { schema });

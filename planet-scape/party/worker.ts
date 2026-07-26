import { routePartykitRequest } from "partyserver";
import GameRoom from "./gameRoom";
import Directory from "./directory";

/**
 * Punto de entrada del Worker — ver docs/PRE-PROD.md Fase 5. Reemplaza el
 * enrutamiento automático que la plataforma gestionada de PartyKit hacía por
 * detrás de `partykit.json#parties`. `routePartykitRequest` entiende la
 * misma forma de URL que ya usa el cliente (`partysocket`, sin cambios):
 * `/parties/main/{roomId}` → GameRoom (sala principal), `/parties/directory/{id}`
 * → Directory (lista de salas abiertas).
 */
export { GameRoom, Directory };

export type Env = {
  MAIN: DurableObjectNamespace<GameRoom>;
  DIRECTORY: DurableObjectNamespace<Directory>;
  APP_ORIGIN: string;
  PARTYKIT_SHARED_SECRET: string;
};

const worker = {
  async fetch(request: Request, env: Env) {
    const response = await routePartykitRequest(request, env as unknown as Record<string, unknown>);
    return response ?? new Response("Not found", { status: 404 });
  },
};

export default worker;

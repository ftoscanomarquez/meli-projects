# DIAGRAMAS.md — Planet Scape of the Solar System

> Diagrama de clases, máquinas de estado, diagramas de secuencia y modelo de persistencia.
> Sincronizado con [`AGENTS.md`](./AGENTS.md) y [`SPECIFICATION-SUMMARY.md`](./SPECIFICATION-SUMMARY.md) — ver regla de sincronización en [AGENTS.md §0.1](./AGENTS.md#01-regla-de-sincronizacion-de-documentacion).

---

## 1. Diagrama de Clases (dominio)

> `Planet` y `AbilityTemplate` son colecciones dinámicas gestionables desde el admin (ver [`SPECIFICATION-SUMMARY.md` §3.1](./SPECIFICATION-SUMMARY.md#31-reglas-de-negocio-planetas-y-habilidades-dinamicas)) — ya no son un enum fijo en código.

```mermaid
classDiagram
    class Player {
        +string id
        +string email
        +string displayName
        +number stars
        +string[] unlockedPlanets
        +Role role
        +Date createdAt
        +Date lastLoginAt
    }

    class StarTransaction {
        +string id
        +string playerId
        +number amount
        +Reason reason
        +string relatedSessionId
        +Date createdAt
    }

    class GameSession {
        +string id
        +string roomId
        +string[] playerIds
        +Date startedAt
        +Date endedAt
        +number levelReached
        +Map~string, number~ starsCollected
    }

    class LeaderboardEntry {
        +string playerId
        +string displayName
        +number bestScore
        +number levelReached
        +Date achievedAt
    }

    class GameConfig {
        +SunConfig sun
        +number pulsarSpawnFreqMs
        +number starSpawnFreqMs
        +BlackHoleConfig blackHole
        +string whatsappParentPitch
        +DonationConfig donation
    }

    class Donation {
        +string id
        +string playerId
        +number amountCents
        +string stripeSessionId
        +DonationStatus status
        +Date createdAt
    }

    class Planet {
        +string id
        +string key
        +string displayName
        +UnlockType unlockType
        +number starCost
        +string activeAbilityId
        +string passiveAbilityId
        +string visualKey
        +boolean isBuiltIn
    }

    class AbilityTemplate {
        +string id
        +string key
        +string displayName
        +AbilityType type
        +EffectType effectType
        +number durationMs
        +number cooldownMs
        +Map~string, number~ params
        +boolean isExclusive
    }

    class BlackHoleConfig {
        +number size
        +number attractionForce
        +number minClicksToDefeat
        +number maxClicksToDefeat
    }

    Player "1" --> "0..*" StarTransaction : genera
    Player "0..*" --> "0..*" GameSession : participa
    Player "1" --> "0..1" LeaderboardEntry : mejor puntaje
    Player "1" --> "0..*" Donation : realiza
    GameConfig "1" --> "1" BlackHoleConfig : configura
    Player "0..*" --> "0..*" Planet : desbloquea (unlockedPlanets, ref. por key)
    Planet "0..1" --> "0..1" AbilityTemplate : activa
    Planet "0..1" --> "0..1" AbilityTemplate : pasiva
```

---

## 2. Diagramas de Máquina de Estados

### 2.1 Habilidad de Planeta (Activa)

```mermaid
stateDiagram-v2
    [*] --> Lista
    Lista --> Activa: input (Spacebar / clic izq. PC, tap flotante móvil)
    Activa --> Recarga: duración de habilidad expira
    Recarga --> Lista: tiempo de cooldown expira

    note right of Lista
        Indicador verde/cian brillante
    end note
    note right of Activa
        Indicador rosa/magenta
    end note
    note right of Recarga
        Indicador gris
    end note
```

### 2.2 Agujero Negro

> Actualizado 2026-07-22: la fase Activa ya **no expira sola** — el usuario pidió que el Agujero Negro permanezca hasta ser derrotado a clics, volviéndose más fuerte mientras más tiempo sobrevive (ver [`AGENTS.md` §4](./AGENTS.md#4-motor-grafico-y-animacion)). El diagrama original tenía una transición `Activo --> Oculto` por expiración de tiempo que ya no existe en el código (`engine/entities/BlackHole.ts`).

```mermaid
stateDiagram-v2
    [*] --> Oculto
    Oculto --> Advertencia: spawn aleatorio programado
    Advertencia --> Activo: 3s / 120 frames (enana azul neón parpadeando en el punto exacto)
    Activo --> Activo: sigue activo — crece en tamaño y fuerza de atracción\nhasta 1.8x/3x a lo largo de una rampa de 20s
    Activo --> Derrotado: clics requeridos alcanzados\n(3 en nivel 0 → 20 en nivel máximo)
    Derrotado --> [*]: sube de nivel

    note right of Activo
        Ya no expira solo. Atrae asteroides/
        rocas en espiral hasta "tragárselas";
        atracción leve sobre planetas (resta
        vidas si caen dentro). Solo termina
        al ser derrotado a clics.
    end note
```

### 2.3 Partida (Game Session)

```mermaid
stateDiagram-v2
    [*] --> Lobby: POST /api/rooms
    Lobby --> EnCurso: temporizador 180s expira O jugador pulsa "Iniciar Juego"
    EnCurso --> Finalizada: todos los jugadores pierden todas sus vidas
    Finalizada --> [*]: POST /api/sessions/:id/complete
```

---

## 3. Diagramas de Secuencia

### 3.1 Login por Magic Link

```mermaid
sequenceDiagram
    actor U as Usuario
    participant UI as Next.js (Cliente)
    participant API as Auth.js (API Route)
    participant Mail as Mailpit / Email real
    participant DB as MongoDB

    U->>UI: ingresa email
    UI->>API: POST /api/auth/signin
    API->>API: genera token firmado de un solo uso
    API->>Mail: envía correo con enlace mágico
    API->>DB: upsert Player (crea perfil si no existe, stars=0)
    Mail-->>U: correo recibido
    U->>UI: clic en enlace mágico
    UI->>API: valida token
    API->>DB: lastLoginAt = now()
    API-->>UI: sesión JWT creada
    UI-->>U: redirige a landing / selección de planeta
```

### 3.2 Partida Multijugador (creación → cierre)

```mermaid
sequenceDiagram
    actor P1 as Jugador 1 (host)
    actor P2 as Jugador 2..4
    participant UI as Next.js
    participant Room as PartyKit Room
    participant API as Next.js API
    participant DB as MongoDB

    P1->>UI: crea partida
    UI->>API: POST /api/rooms
    API->>Room: crea room (roomId)
    P1->>Room: conecta WebSocket
    Room-->>P1: inicia lobby (180s)
    P2->>Room: conecta WebSocket (join)
    alt tiempo de espera agotado o "Iniciar Juego" pulsado
        Room->>Room: inicia loop de física (Sol, asteroides, agujero negro)
    end
    loop cada frame
        P1->>Room: input de posición (~20 msg/s)
        P2->>Room: input de posición (~20 msg/s)
        Room-->>P1: estado interpolado de todos los jugadores/entidades
        Room-->>P2: estado interpolado de todos los jugadores/entidades
    end
    Room->>API: POST /api/sessions/:id/complete (estrellas por jugador, nivel alcanzado)
    API->>DB: crea StarTransaction por jugador + actualiza Leaderboard
```

### 3.3 Aportación Voluntaria (Stripe)

```mermaid
sequenceDiagram
    actor U as Usuario
    participant UI as Next.js (Cliente)
    participant API as Next.js API
    participant Stripe as Stripe Checkout
    participant DB as MongoDB

    U->>UI: ajusta slider (mín. $100 MXN) y confirma
    UI->>API: POST /api/donations/checkout (amountCents)
    API->>DB: crea Donation (status=pending)
    API->>Stripe: crea Checkout Session
    Stripe-->>UI: redirige a formulario de pago
    U->>Stripe: completa el pago
    Stripe->>API: webhook checkout.session.completed
    API->>API: valida firma del webhook
    API->>DB: Donation.status=completed (idempotente por stripeSessionId)
    API->>DB: StarTransaction +200 (reason=donation_reward)
    API->>DB: Player.stars += 200
    API-->>UI: modal de agradecimiento (mensaje Meli/Francisco + link WhatsApp)
```

### 3.4 Admin crea un Planeta Nuevo

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as Panel Admin (Cliente)
    participant API as Next.js API
    participant DB as MongoDB

    A->>UI: define nombre, unlockType, starCost (si aplica)
    UI->>API: GET /api/admin/abilities
    API->>DB: lista ability_templates disponibles (no exclusivas de otro planeta)
    API-->>UI: catálogo de habilidades activas/pasivas asignables
    A->>UI: elige activeAbilityId / passiveAbilityId (o crea una nueva vía POST /api/admin/abilities)
    UI->>API: POST /api/admin/planets
    API->>API: valida rol admin
    alt unlockType == "stars"
        API->>DB: marca las AbilityTemplate elegidas como isExclusive=true
    end
    API->>DB: inserta Planet (isBuiltIn=false)
    API-->>UI: 201 Created — planeta disponible de inmediato en /api/planets
```

### 3.5 Admin edita el balance del juego ✅ implementado y probado

```mermaid
sequenceDiagram
    actor A as Admin
    participant UI as /admin (Cliente)
    participant API as Next.js API
    participant DB as MongoDB
    actor J as Jugador (partida nueva)

    A->>UI: GET /admin (Server Component valida session.user.role)
    UI->>API: GET /api/admin/config
    API->>API: requireAdminSession (401/403 si no aplica)
    API->>DB: game_config.findOne()
    API-->>UI: GameConfig actual
    A->>UI: edita un valor (ej. blackHole.minClicksToDefeat)
    UI->>API: PUT /api/admin/config (GameConfig completo)
    API->>API: GameConfigSchema.safeParse
    API->>DB: game_config.updateOne({}, $set, upsert)
    API-->>UI: config guardada — confirmación inline ("¡Guardado!")
    J->>API: GET /play o /lobby (Server Component)
    API->>DB: getGameConfig() — sin caché, siempre el doc actual
    API-->>J: partida nueva ya usa el valor editado, sin redeploy
```

### 3.6 Salas abiertas (directorio de lobbies) ✅ implementado y probado

```mermaid
sequenceDiagram
    actor P1 as Jugador 1 (crea sala)
    actor P2 as Jugador 2 (ve la lista)
    participant Room as PartyKit "main" (sala X)
    participant Dir as PartyKit "directory" (sala fija "global")

    P1->>Room: conecta (crea la sala X)
    Room->>Dir: POST resumen {roomId, playerCount, maxPlayers, status, planetsTaken}
    Dir-->>Dir: guarda/actualiza en memoria y difunde la lista completa
    P2->>Dir: conecta (pantalla "crear/unirse a sala")
    Dir-->>P2: lista de salas abiertas (sala X: 1/4, "lobby")
    P2->>Room: conecta a la sala X (botón "Unirme")
    Room->>Dir: POST resumen actualizado (2/4)
    Dir-->>P2: lista actualizada en vivo (sin polling)
    Note over Room: al llegar a 4/4, el botón "Unirme" se deshabilita en el cliente
    P1->>Room: "Iniciar ahora" (o se llena la sala / vence el lobby)
    Room-->>P1: gameStart {seed, startAt}
    Room-->>P2: gameStart {seed, startAt}
    Note over P1,P2: ambos muestran "Creando sesión del juego..." hasta `startAt`
    Room->>Dir: POST resumen {status: "playing"}
    P1->>P1: monta GameCanvas en startAt
    P2->>P2: monta GameCanvas en startAt
```

---

## 4. Modelo de Persistencia (MongoDB)

```mermaid
erDiagram
    PLAYERS ||--o{ STAR_TRANSACTIONS : genera
    PLAYERS ||--o{ DONATIONS : realiza
    PLAYERS ||--o| LEADERBOARD : "mejor puntaje"
    PLAYERS }o--o{ GAME_SESSIONS : participa
    PLAYERS }o--o{ PLANETS : "desbloquea (unlockedPlanets, ref. por key)"
    GAME_SESSIONS ||--o{ STAR_TRANSACTIONS : "origina (reason=gameplay)"
    PLANETS |o--o| ABILITY_TEMPLATES : "activa"
    PLANETS |o--o| ABILITY_TEMPLATES : "pasiva"

    PLAYERS {
        ObjectId _id PK
        string email UK
        string displayName
        int stars
        string[] unlockedPlanets
        string role
        date createdAt
        date lastLoginAt
    }
    STAR_TRANSACTIONS {
        ObjectId _id PK
        ObjectId playerId FK
        int amount
        string reason
        ObjectId relatedSessionId FK
        date createdAt
    }
    GAME_SESSIONS {
        ObjectId _id PK
        string roomId
        ObjectId[] playerIds FK
        date startedAt
        date endedAt
        int levelReached
    }
    LEADERBOARD {
        ObjectId playerId PK-FK
        string displayName
        int bestScore
        int levelReached
        date achievedAt
    }
    DONATIONS {
        ObjectId _id PK
        ObjectId playerId FK
        int amountCents
        string currency
        string stripeSessionId UK
        string status
        date createdAt
    }
    GAME_CONFIG {
        ObjectId _id PK
        object sun
        object pulsars
        object stars
        object blackHole
        object whatsappLinks
        object donation
    }
    PLANETS {
        ObjectId _id PK
        string key UK
        string displayName
        string unlockType
        int starCost
        ObjectId activeAbilityId FK
        ObjectId passiveAbilityId FK
        string visualKey
        boolean isBuiltIn
        date createdAt
        date updatedAt
    }
    ABILITY_TEMPLATES {
        ObjectId _id PK
        string key UK
        string displayName
        string type
        string effectType
        int durationMs
        int cooldownMs
        object params
        boolean isExclusive
        date createdAt
        date updatedAt
    }
```

`game_config` es un documento único (sin relación FK) leído por el servidor de PartyKit y por el panel admin — ver [AGENTS.md §7](./AGENTS.md#7-persistencia--decision-y-justificacion). `planets` y `ability_templates` son catálogos dinámicos editables/creables desde el admin — ver reglas de negocio, incluida la exclusividad de habilidades de planetas `unlockType: "stars"`, en [`SPECIFICATION-SUMMARY.md` §3.1](./SPECIFICATION-SUMMARY.md#31-reglas-de-negocio-planetas-y-habilidades-dinamicas).

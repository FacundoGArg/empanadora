# EmpanaDora

![EmpanaDora cover](public/images/menu/readme-cover.jpg)

Dora es una vendedora digital con IA y una plataforma de gestion para empanaderias. Automatiza ventas por chat, administra pedidos de punta a punta y centraliza analitica operativa para el negocio.

## Que construye este repo

- Asistente conversacional de ventas que entiende menu, promociones y stock.
- Flujo transaccional completo: carrito, medios de pago, envio y confirmacion.
- Plataforma merchant-facing con paneles para conversaciones, pedidos, menu e inventario.
- Motor de analitica basica y trazabilidad de conversaciones y ordenes.
- Buscador de documentos y promos con embeddings (Pinecone) para soporte y contexto.

## Arquitectura y stack

- Next.js App Router con React 19
- Prisma + MongoDB para datos de productos, pedidos, conversaciones e inventario.
- Vercel AI SDK + OpenAI para clasificacion de intencion y respuestas con tools.
- Pinecone para embeddings y busqueda de documentos.
- Tailwind + Radix UI para la interfaz.

## Estructura del proyecto

- `src/app` rutas UI y API (App Router)
- `src/app/api` endpoints para chat, conversaciones, pedidos y documentos
- `src/app/platform` panel interno (dashboard, chats, pedidos, menu, inventario)
- `src/app/docs` visor de PDFs servidos desde `/api/docs`
- `src/components` UI, chat, elementos de IA y vistas de inventario
- `src/lib/services` logica de negocio (pedidos, promociones, menu, conversaciones)
- `src/lib/repository` acceso a datos con Prisma
- `src/lib/ai/tools` tools que el asistente usa en `/api/chat`
- `src/lib/ai/evals` casos de evaluacion del asistente
- `src/lib/docs` documentos que se indexan para busquedas
- `src/lib/scripts` scripts de seed y carga de embeddings
- `company` PDFs internos (presentacion comercial + plan de producto)

## Material interno

En `company/` hay dos PDFs de referencia:

- `EmpanaDora - Presentation Deck.pdf`: presentacion comercial para potenciales clientes.
- `Product Plan - Dora.pdf`: plan de desarrollo de producto con estrategia y futuras iteraciones.

## Como correr el proyecto

### Requisitos

- Node 18+ (recomendado 20)
- MongoDB accesible por `DATABASE_URL`

### 1) Instalar dependencias

```bash
npm install
```

### 2) Configurar variables de entorno

Crea un archivo `.env` en la raiz con las variables de entorno.


```bash
# .env.example
DATABASE_URL="mongodb+srv://..."
OPENAI_API_KEY="..."
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_DIMENSIONS="1536"
PINECONE_API_KEY="..."
PINECONE_INDEX_NAME="empanadora-docs"
PUBLIC_DOCS_BASE_URL="https://tu-dominio.com/docs"
EVAL_BASE_URL="https://tu-entorno.com"
```

### 3) Preparar la base de datos

```bash
npm run prisma:generate
```

Opcional para resetear la base de datos:

```bash
npm run prisma:reset
```

Opcional para cargar datos de ejemplo:

```bash
npm run prisma:seed
```

### 4) (Opcional) Indexar documentos en Pinecone

```bash
npm run prep:docs
```

### 5) Levantar el entorno

```bash
npm run dev
```

Luego accede a la URL que te indique tu entorno local.

### (Opcional) Correr evals

```bash
npm run evals
```

## Rutas principales

- `/` chat principal con el asistente de ventas
- `/platform` dashboard merchant-facing
- `/platform/chats` historial de conversaciones
- `/platform/orders` ordenes confirmadas
- `/platform/menu` menu y promociones
- `/platform/inventory` control de stock
- `/docs/[...slug]` visor de documentos PDF

## API clave

- `POST /api/chat` pipeline de IA con clasificacion + tools + streaming
- `POST /api/conversations` crea una conversacion
- `POST /api/conversations/:id/close` cierra una conversacion
- `POST /api/orders/active` crea o retorna carrito activo
- `POST /api/orders/:id/items` agrega o actualiza items
- `DELETE /api/orders/:id/items` elimina items
- `POST /api/orders/:id/confirm` confirma una orden
- `GET /api/docs/[...slug]` entrega PDFs publicos

## Scripts utiles

- `npm run dev` entorno local
- `npm run build` build de produccion
- `npm run prisma:seed` carga datos de ejemplo
- `npm run prisma:reset` resetea la base de datos
- `npm run prep:docs` embeddings y upsert en Pinecone
- `npm run evals` corre casos de evaluacion del asistente

## RAG (Retrieval Augmented Generation)

El asistente tiene una capa de RAG para responder con informacion respaldada por documentos del negocio.

- Indexacion: `npm run prep:docs` genera embeddings de los PDFs y los sube a Pinecone.
- Recuperacion: el tool `docsSearch` consulta Pinecone y devuelve fragmentos relevantes.
- Respuesta: el modelo usa esos fragmentos como contexto y la UI muestra sources cuando hay URL publica disponible.
- Documentos publicos: se guardan en `src/lib/docs/public`, se sirven via `/api/docs` y aparecen como links clickeables en la UI.
- Documentos privados: se guardan en `src/lib/docs/private`, solo enriquecen el contexto del agente y no se exponen como links en la UI.

## Ejemplos de prompts y comportamiento esperado

Las siguientes capturas ejemplifican situaciones que el agente está capacitado para manejar:

1. Posibilidad de leer y compartir el menú:
![Prompt example 1](public/images/menu/prompt-example-1.png)

2. Posibilidad de leer y promociones vigentes:
![Prompt example 2](public/images/menu/prompt-example-2.png)

3. Capacidad para guiar al usuario en el armado de su pedido:
![Prompt example 3](public/images/menu/prompt-example-3.png)

4. Posibilidad de crear el carrito y actualizarlo a pedido del usuario:
![Prompt example 4](public/images/menu/prompt-example-4.png)

5. Entendimiento del pedido y de la aplicación de las promociones disponibles:
![Prompt example 5](public/images/menu/prompt-example-11.png)

6. Recomendar otros productos para complementar el pedido:
![Prompt example 5](public/images/menu/prompt-example-5.png)

7. Requerir la información necesaria para confirmar los pedidos:
![Prompt example 6](public/images/menu/prompt-example-6.png)

8. Acceder a documentos marcados como públicos para responder y compartir con los usuarios:
![Prompt example 7](public/images/menu/prompt-example-7.png)

9. Acceder a documentos marcados como privados solo para tomar información de contexto para responder:
![Prompt example 8](public/images/menu/prompt-example-8.png)

![Prompt example 9](public/images/menu/prompt-example-9.png)

10. Capacidad de reconocer cuando una instrucción está fuera de su alcance y responder de manera adecuada:
![Prompt example 10](public/images/menu/prompt-example-10.png)


## Notas operativas

- El asistente usa tools en `src/lib/ai/tools` para consultar menu, promos y pedidos.
- La logica de negocio vive en `src/lib/services`, separada del acceso a datos en `src/lib/repository`.
- Los documentos de soporte se guardan en `src/lib/docs` con separacion publica/privada.

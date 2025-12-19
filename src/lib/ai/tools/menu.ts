import { tool } from 'ai';
import { z } from 'zod';

import { getActiveMenuDetails } from '@/lib/services/menu-service';

export const getActiveMenu = tool({
  description: 'Obtiene el menú activo junto con todos los productos y precios disponibles.',
  inputSchema: z.object({
    menuId: z
      .string()
      .optional()
      .describe('Identificador del menú a consultar. Si no se envía, se usa el menú activo.'),
    includeInactive: z
      .boolean()
      .optional()
      .describe('Si es true, permite devolver un menú inactivo en caso de especificar el ID. Por defecto solo menús activos.'),
  }),
  execute: ({ menuId, includeInactive }) =>
    getActiveMenuDetails({ menuId, includeInactive }),
});

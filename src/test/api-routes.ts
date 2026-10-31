const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const routeModules = import.meta.glob<Record<string, unknown>>('/src/routes/api/**/+server.ts', {
    eager: true
});

/** `/src/routes/api/bottles/[id]/+server.ts` → `/api/bottles/[id]` */
const routeIdOf = (file: string) =>
    file.replace(/^\/src\/routes/, '').replace(/\/\+server\.ts$/, '');

/** Every route and method of the API, as the route modules export them. */
export const apiRoutes = Object.entries(routeModules).flatMap(([file, module]) =>
    Object.keys(module)
        .filter((name) => METHODS.includes(name))
        .map((method) => ({ method, routeId: routeIdOf(file) }))
);

# The official Node.js image, pinned by digest: a tag can be moved. Updating it: see AGENTS.md.
# .nvmrc names the same version, which CI tests with.
ARG NODE_IMAGE=node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

FROM ${NODE_IMAGE} AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install the pnpm version pinned by "packageManager" in package.json: any other pnpm 10
# would download that version on its first run. pnpm 11+ ignores the
# "pnpm.onlyBuiltDependencies" field of package.json, so keep the pin on pnpm 10.
RUN npm install -g "$(node -p "require('./package.json').packageManager")"
# No install scripts. The project's prepare script would fail, since the sources are not copied
# yet, and the build below does its work (Paraglide's compilation and svelte-kit sync). No
# dependency needs one either: esbuild's only checks its binary, and better-sqlite3 ships prebuilt
# binaries for musl on x64 and arm64, so the image needs no build tools. Only amd64 and arm64 are
# released: on a platform without a prebuilt binary, nothing compiles one.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# adapter-node bundles the devDependencies into build/, so the runtime only needs the others. The
# optional ones, which the server never loads, are jsPDF's helpers for HTML and SVG in the browser
# and drizzle-orm's optional peers (kysely, @types/better-sqlite3).
# Without --ignore-scripts, prune runs the prepare script, which needs the devDependencies it removes.
RUN pnpm prune --prod --no-optional --ignore-scripts

# better-sqlite3 loads only prebuilds/linuxmusl-<arch>.node here: drop the binaries of the other
# platforms and the SQLite sources, which only a compilation would use.
# Stops the build if that binary is missing, rather than delete every one.
RUN cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && \
    test -f "prebuilds/linuxmusl-$(node -p process.arch).node" && \
    rm -r deps src && \
    find prebuilds -type f ! -name "linuxmusl-$(node -p process.arch).node" -delete

# Production stage
FROM ${NODE_IMAGE} AS production

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=base /app/build ./build
COPY --from=base /app/server.js ./
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/drizzle ./drizzle

# The default CSV files, at the path the seeding reads them from
COPY --from=base /app/scripts/data ./scripts/data

# Only the volume directories are writable by the app; a fresh named volume inherits this owner.
# Bind mounts keep the host owner, which must be uid 1000 or match `user:` (see README-Docker.md).
RUN mkdir -p /app/data /app/static/uploads /app/csv-imports && \
    chown node:node /app/data /app/static/uploads /app/csv-imports

# The node user (uid 1000) comes with the official Node.js image
USER node

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# Global cap on request bodies, just above the 500 MB that restore and the imports accept.
# Upload routes answer 413 before reading the body only when the request sends Content-Length;
# a chunked upload is read up to this cap before its file size is checked.
ENV BODY_SIZE_LIMIT=512M

# The only healthcheck: docker-compose.yml no longer defines one. / answers 200 (src/routes/+page.ts).
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "http.get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application (server.js applies ORIGIN, then starts build/)
CMD ["node", "server.js"]
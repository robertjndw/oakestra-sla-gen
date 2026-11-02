# syntax=docker/dockerfile:1
#
# Build contexts:
#   - the default context is this repo's frontend/ folder
#   - the named context "dashboard" is a checkout of oakestra-dashboard-v2 at the commit in
#     DASHBOARD_REF; the addon links its SDK and UI packages from source
#
#   docker buildx build --build-context dashboard=../oakestra-dashboard-v2 \
#     -f frontend/addon/Dockerfile -t sla-gen-addon-ui frontend
#
# The checkouts are laid out as /work/oakestra-dashboard-v2 and /work/oakestra-sla-gen/frontend
# because addon/package.json links the dashboard packages by the relative path
# ../../../oakestra-dashboard-v2/packages/*.

# The output is static files, so build once on the host's platform rather than under emulation.
FROM --platform=$BUILDPLATFORM node:24-slim AS build
RUN npm install --global pnpm@12.16.1
WORKDIR /work

# Host node_modules and dist would be wrong for this platform (and huge), so keep them out.
COPY --from=dashboard --exclude=**/node_modules --exclude=**/dist . oakestra-dashboard-v2/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    cd oakestra-dashboard-v2 && pnpm install --frozen-lockfile \
      --filter "@oakestra/dashboard-sdk..." --filter "@oakestra/ui..."

# The addon resolves react and friends from frontend/node_modules, so install that first.
WORKDIR /work/oakestra-sla-gen/frontend
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

COPY addon/package.json addon/pnpm-lock.yaml addon/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    cd addon && pnpm install --frozen-lockfile

COPY . .
RUN cd addon && pnpm build

FROM nginx:1.30-alpine
# Only these two are substituted into the template, so nginx's own $uri etc. survive.
ENV API_UPSTREAM=http://root_sla_gen:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="API_UPSTREAM|NGINX_LOCAL_RESOLVERS"
COPY addon/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /work/oakestra-sla-gen/frontend/addon/dist /usr/share/nginx/html
# Addon UI contract: plain HTTP on port 80, reachable as addonui-<name> on the dashboard network.
EXPOSE 80

# syntax=docker/dockerfile:1
#
# The context is this repo's frontend/ folder. @oakestra/dashboard-sdk and @oakestra/ui come from
# GitHub Packages, which needs a token with read:packages even for public packages. Pass it as a
# build secret so it stays out of the image:
#
#   NODE_AUTH_TOKEN=$(gh auth token) docker buildx build \
#     --secret id=node_auth_token,env=NODE_AUTH_TOKEN \
#     -f frontend/addon/Dockerfile -t sla-gen-addon-ui frontend

# The output is static files, so build once on the host's platform rather than under emulation.
FROM --platform=$BUILDPLATFORM node:24-slim AS build
RUN npm install --global pnpm@12.16.1
# pnpm ignores registry tokens in the repo's .npmrc, so it goes in the user config. This only
# writes the placeholder, the real value comes from the secret mounted during install.
RUN printf '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n' > /root/.npmrc
WORKDIR /work/frontend

# The addon resolves react and friends from frontend/node_modules, so install that first.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

COPY addon/package.json addon/pnpm-lock.yaml addon/pnpm-workspace.yaml addon/.npmrc addon/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN,required=true \
    cd addon && pnpm install --frozen-lockfile

COPY . .
RUN cd addon && pnpm build

FROM nginx:1.30-alpine
# Only these two are substituted into the template, so nginx's own $uri etc. survive.
ENV API_UPSTREAM=http://root_sla_gen:8000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="API_UPSTREAM|NGINX_LOCAL_RESOLVERS"
COPY addon/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /work/frontend/addon/dist /usr/share/nginx/html
# Addon UI contract: plain HTTP on port 80, reachable as addonui-<name> on the dashboard network.
EXPOSE 80

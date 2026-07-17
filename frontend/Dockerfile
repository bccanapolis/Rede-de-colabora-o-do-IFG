FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# --- Estágio de desenvolvimento (usado pelo docker-compose.yml) ---
FROM base AS dev
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- Estágio de build (usado pelo estágio de produção) ---
FROM base AS build
RUN npm run build

# --- Estágio de produção (usado pelo docker-compose.prod.yml) ---
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

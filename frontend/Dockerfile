# frontend/Dockerfile

# STAGE 1: Build the app
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (dev + prod)
RUN pnpm install

# Copy the rest of the app's source code
COPY . .

# Build the app
RUN pnpm build

# STAGE 2: Serve the app
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only necessary files from the 'builder' stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# --- THE FIX IS HERE ---
# Copy the entire node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Prune (remove) development-only packages
# This is MUCH faster than re-installing
RUN pnpm prune --prod

# Expose port 3000
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"]
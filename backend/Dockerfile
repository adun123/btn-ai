FROM node:20-alpine

# Install curl for health check
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY src ./src
COPY supabase ./supabase

# Create directory for uploads if needed
RUN mkdir -p /tmp/uploads

# Expose the port
EXPOSE 4000

# Start the application
CMD ["npm", "start"]

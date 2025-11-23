# Use a lightweight Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache for dependencies
COPY package.json ./

# Install production dependencies
# We use --omit=dev to keep the image small
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define environment variable for production
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
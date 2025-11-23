# Use a lightweight Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache for dependencies
COPY package.json ./

# Install ALL dependencies (including devDependencies like esbuild)
# Important: We need devDeps to run the 'npm run build' script successfully
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the React application (generates bundle.js)
# The build script in package.json handles the bundling
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Define environment variable for production
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
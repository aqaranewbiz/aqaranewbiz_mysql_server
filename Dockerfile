# Use a minimal Python image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY package*.json ./
RUN npm install

# Copy the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3003

# Command to run the application
CMD ["node", "index.js"] 

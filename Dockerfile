# Development container: runs the frontend and the backend together.
# Source code is bind-mounted at /workspace by docker-compose.yml.
FROM node:22

# MongoDB shell, to query the database from the container terminal
RUN npm install -g mongosh

WORKDIR /workspace

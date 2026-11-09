# Development container: runs the frontend and the backend together.
# Source code is bind-mounted at /workspace by docker-compose.yml.
# 22.9 at least: the backend starts with `node --env-file-if-exists`
FROM node:22.23

# MongoDB shell, to query the database from the container terminal
RUN npm install -g mongosh

WORKDIR /workspace

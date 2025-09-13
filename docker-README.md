# FIESC Exam Scheduler - Docker Setup

This document explains how to run the FIESC Exam Scheduler application using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/SocoliucRobert/derulo.git
   cd derulo
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   
3. Edit the `.env` file with your specific configuration values.

## Running the Application

To start all services (database, backend, frontend):

```bash
docker-compose up
```

To run in detached mode (background):

```bash
docker-compose up -d
```

## Accessing the Application

- Frontend: http://localhost
- Backend API: http://localhost:5000

## Services

The application consists of three main services:

1. **PostgreSQL Database** (db)
   - Port: 5432
   - Credentials: postgres/postgres (configurable in docker-compose.yml)

2. **Flask Backend** (backend)
   - Port: 5000
   - Automatically connects to the database

3. **React Frontend** (frontend)
   - Port: 80
   - Served via Nginx

## Development Mode

For development, you can modify the docker-compose.yml to use volumes for hot-reloading:

1. For the backend, it's already set up with volumes for development.

2. For the frontend, uncomment the volume and command lines in docker-compose.yml:
   ```yaml
   frontend:
     # ...
     volumes:
       - ./frontend:/app
       - /app/node_modules
     command: npm start
   ```

## Stopping the Application

```bash
docker-compose down
```

To remove volumes as well (will delete database data):

```bash
docker-compose down -v
```

## Troubleshooting

1. **Database Connection Issues**
   - Check if the database container is running: `docker ps`
   - Verify the DATABASE_URL in the backend environment

2. **Frontend Not Loading**
   - Check if the frontend container is running: `docker ps`
   - Inspect logs: `docker logs derulo-frontend`

3. **Backend API Errors**
   - Check backend logs: `docker logs derulo-backend`

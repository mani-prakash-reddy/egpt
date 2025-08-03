# Setup

1. Clone the repository:

2. I. create .env file in the root directory (copy .env.example to .env and fill in the values)  
   II. create .env file in the frontend directory

3. Install frontend dependencies:

    ```bash
    cd frontend
    npm install
    ```

4. Start the frontend development server:

    ```bash
    npm run dev
    ```

5. Start the backend server:

    ```bash
    cd to_project_root
    docker compose up
    ```

This will start the python fastapi server, postgres(pgvector) database, litellm proxy server and nginx reverse proxy server.

## Routes

- **Frontend [build]**: The frontend is served at `http://localhost`
- **Backend**:
  - The backend API is available at `http://localhost/api/v1`
  - The backend Swagger API documentation is available at `http://localhost/docs`
  - The backend OpenAPI schema is available at `http://localhost/openapi.json`
- **Database**: The database is accessible at `http://localhost:5432`
- **Litellm Proxy**: The litellm proxy is available at `http://localhost:4000`
- **Nginx**: The nginx reverse proxy is available at `http://localhost`
- **Frontend [dev]**: The frontend development server is available at `http://localhost:5173`

## Adding New Models

- Add the llm provider configuration and api keys in `litellm_config.yaml` file in the root directory. [litellm config.yaml documentation](https://docs.litellm.ai/docs/proxy/config_settings)
- It is better to use environment variables in this file and add those variables in the `.env` file.

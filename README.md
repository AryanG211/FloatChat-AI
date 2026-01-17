<h1 align="center">FloatChat AI – Ocean Data Query System</h1>  

---

## Preview  

### Query Using Map
![Query Using Map](https://drive.google.com/uc?export=view&id=1BqTUMUINw44L96veiK-9LwnkHlOvHLVc)

### Line Chart Visualization
![Line Chart Visualization](https://drive.google.com/uc?export=view&id=1g5lLkvr_s9UuzDn_vnFqXxhJ2qTlTODp)

### Bar Chart Visualization
![Bar Chart Visualization](https://drive.google.com/uc?export=view&id=1_YRKDylbs7xJsG-lnNLOlm5Ufdny135A)

### Data in Tabular Format
![Data in Tabular Format](https://drive.google.com/uc?export=view&id=1Py6pHvP3Yvuhds7nRkEGP5r_NZPDbY2l)  

### Region Based Querying
![Region Based Querying](https://drive.google.com/uc?export=view&id=1-d4UX6vH_1MZ0RWfE7LzIllVY9xY8Et2)  

---


## Project Structure  

### Backend  

| File | Description |
|------|-------------|
| `api_server.py` | Hosts the backend API server and routes user queries |
| `final_backend_code.py` | Core backend logic; processes queries, integrates FAISS/DB, and APIs |
| `queries.sql` | SQL queries and schema definitions for database operations |
| `requirements.txt` | Python dependencies for backend services |

---

### Frontend  

| File / Folder | Description |
|---------------|-------------|
| `app/` | Main Next.js application entry point (pages, routing, layouts) |
| `components/` | Reusable UI components (buttons, cards, forms, etc.) |
| `contexts/` | React context providers (global state management) |
| `hooks/` | Custom React hooks for reusing logic |
| `lib/` | Utility functions and helper methods |
| `public/` | Static assets (images, icons, etc.) |
| `services/` | API service calls (connecting frontend with backend) |
| `styles/` | Global styles, TailwindCSS/PostCSS configurations |
| `.gitignore` | Ignored files for Git version control |
| `components.json` | Configuration file for managing UI components |
| `jsconfig.json` | Path aliases and project settings for Next.js/React |
| `location.png` | Project-related image asset |
| `next.config.mjs` | Next.js configuration file |
| `package.json` | Frontend project dependencies and scripts |
| `package-lock.json` | Locked versions of npm dependencies |
| `pnpm-lock.yaml` | Locked versions of pnpm dependencies |
| `postcss.config.mjs` | PostCSS configuration (used with TailwindCSS) |

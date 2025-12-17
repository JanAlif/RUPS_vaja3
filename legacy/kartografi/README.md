# kartografi

A minimal **MERN** starter with separate `backend` (Express + Mongoose) and `frontend` (Vite + React) folders, runnable with one command.  
Includes Docker setup for running MongoDB locally.

---

## 🧩 Prereqs
- **Node.js 18+** (Apple Silicon works great). Recommend installing via `nvm`.
- **Docker** & **Docker Compose** installed (for MongoDB container).
- Optionally: `mongosh` for inspecting your database.

---

## ⚙️ Quick start

```bash
# 1️⃣ clone / link your repo
git clone https://github.com/Tit-Hub230/Kartografi.git
cd Kartografi

# 2️⃣ install dependencies
npm install                   # only needed at root for concurrently
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3️⃣ start MongoDB in Docker
docker compose up -d

#   This will:
#   - pull the official mongo:7 image
#   - run it on localhost:27017
#   - persist data in a Docker volume named "mongo_data"

# check it’s running
docker compose ps
# optional logs
docker compose logs -f mongo

# 4️⃣ run both backend and frontend
npm run dev
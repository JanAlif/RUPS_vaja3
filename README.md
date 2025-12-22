# 🌍⚡ World Power Grid  
### An Interactive Educational Platform Combining Geography and Electrical Engineering

---

## 📘 Project Description

**World Power Grid** is an educational web platform designed to teach children about **world geography, energy production, and electrical systems** through hands-on interaction and problem-solving. The project is the result of combining two previously separate educational ideas:

1. A **geography-focused website** that helps children learn about countries around the world through exploration and quizzes.
2. An **electrical circuit simulation website** where children learn how electricity works by building circuits using a virtual workbench.

By merging these two concepts, World Power Grid creates a **deeper, more immersive learning experience** where geography is no longer abstract and electrical engineering becomes tangible and visual.

---

## 🎯 Project Vision

The core goal of this project is to help children understand how **real-world infrastructure connects countries, cities, and energy systems**. Instead of learning facts in isolation, users learn by **interacting with realistic simulations** that reflect how nuclear power plants supply electricity to millions of people around the world.

This project emphasizes:
- Learning through experimentation
- Visual cause-and-effect feedback
- Real-world inspired systems simplified for children

---

## 🗺️ Global Map Interface

The main interface is an **interactive world map** that acts as the entry point for all gameplay and learning.

### Features:
- A zoomable world map displaying **nuclear power plants at their real geographic locations**
- Country borders and names to reinforce geographic knowledge
- Tooltips and info panels showing:
  - Country name
  - Power plant name
  - Energy output
  - Number of cities or regions powered

Each power plant on the map serves as an **individual challenge** with its own difficulty and learning objectives.

---

## ⚛️ Power Plant Challenges

When a user selects a nuclear power plant, they are taken into a **simulation environment** representing that plant’s electrical grid.

Each plant has unique parameters, such as:
- Maximum power generation capacity
- Cooling system requirements
- Number of connected cities
- Energy demand fluctuations

Larger and more powerful plants require more complex grids, increasing difficulty as the user progresses.

---

## 🧰 Electrical Workbench & Grid Builder

At the heart of the experience is the **electrical workbench**, where users must construct a **fully functioning power grid**.

### Available Components:
- ⚛️ Nuclear reactor (power source)
- 💧 Water pumps and cooling systems
- 🚰 Pipes for water circulation
- ⚡ Electrical wires and connectors
- 🔌 Transformers and substations
- 🏙️ Cities and infrastructure nodes (power consumers)

Users must correctly connect all components so that:
- The reactor is safely cooled
- Power is efficiently distributed
- Demand does not exceed supply
- The grid remains stable over time

The system visually shows power flow, water circulation, and overloads, helping users understand what is happening in real time.

---

## 🧠 Learning Mechanics

The simulation encourages **critical thinking and problem-solving**:

- If the grid is unbalanced, parts of the system may shut down.
- Incorrect wiring can lead to power shortages or overloads.
- Insufficient cooling can cause reactor instability.

The platform allows users to experiment freely while providing **clear feedback** explaining why a design fails or succeeds.

---

## ❌ Failure System & Consequences

To reinforce learning, the platform includes a **failure feedback loop**:

- Each challenge allows a limited number of failed attempts.
- Repeated failures result in the simulation ending.
- The user is returned to the world map.
- The selected power plant is shown as **destroyed or exploded** on the map.

💥 The **explosion size and visual impact** depend on the power output of the plant, reinforcing the idea that larger systems carry greater responsibility and risk.

This mechanic is symbolic and educational, designed to teach consequences without graphic or frightening content.

---

## 🧪 Progression & Difficulty Scaling

- Smaller plants act as beginner levels.
- Larger plants introduce more components and stricter constraints.
- Later challenges may include:
  - Multiple cities with different power demands
  - Maintenance failures
  - Temporary shutdowns or upgrades

This progression ensures continuous learning without overwhelming younger users.

---

## 🎓 Educational Objectives

World Power Grid aims to teach:
- World geography and country recognition
- The basics of nuclear energy production
- Electrical circuits and power distribution
- System dependencies and infrastructure planning
- Responsibility and long-term thinking

All concepts are presented in a **child-friendly, visual, and interactive way**.

---

## 🚀 Future Enhancements

Planned or potential features include:
- Additional energy sources (solar, wind, hydroelectric)
- Geography quizzes tied to unlocking new regions
- Difficulty modes based on age group
- Teacher or parent dashboards
- Progress tracking and achievements
- Real-world comparisons and fun facts

---

## 🧩 Conclusion

World Power Grid transforms abstract topics like geography and electrical engineering into a **living, interactive system**. By combining map-based exploration with hands-on circuit construction, children gain a deeper understanding of how the world is powered—and how everything is connected.

This project demonstrates how combining two educational ideas can create a **richer, more meaningful learning experience** that encourages curiosity, experimentation, and global awareness.

---

⚡ *Power the world. Learn how it works.* 🌍
---

# 🛠️ Detailed Integration Roadmap

Because both original projects are treated as long-term codebases, the integration strategy is **non-invasive**:
- keep both projects largely intact,
- only refactor where necessary to connect flows and unify UX.
- upgrade both project to their respective level (faculty level)

This roadmap describes exactly how to merge them while respecting that constraint.

---

## ✅ Phase 0 — Repository & Baseline Stability

### Goal
Get both legacy projects running from the same repository with **zero functional changes**.

### Tasks
- Keep both projects in `legacy/` (or equivalent) exactly as imported.
- Document how to run each project independently.
- Verify versions:
  - Node version
  - MongoDB requirements
  - Environment variables (`.env.example` for each backend)
- Ensure port separation to avoid conflicts:
  - `geo-backend`: `5001`
  - `circuits-backend`: `5002`
  - `geo-frontend`: `3001`
  - `circuits-frontend`: `3002`

### Deliverable
Both apps work exactly as before, just located in one repo.

---

## ✅ Phase 1 — Monorepo Launcher (No Refactor)

### Goal
Add a root-level “launcher” so developers can start everything consistently.

### Tasks
- Add root `package.json` with scripts for:
  - install all (optional, depending on tool choice)
  - run all (dev)
- Use a simple `concurrently` script to start 4 processes:
  - two frontends
  - two backends

Example root scripts idea:
- `npm run dev:geo`
- `npm run dev:circuits`
- `npm run dev:all`

### Deliverable
One-command startup for dev team (while codebases remain separate).

---

## ✅ Phase 2 — Shared Navigation Shell (Integration Without Merging Code)

### Goal
Create a single “World Power Grid” entry experience while keeping both projects separate.

### Strategy
Add a small **integration shell app** (React) or add a minimal landing page that links to both apps.

You have two valid options:

### Option A (fastest, minimal change)
- Keep both frontends as separate apps on separate ports.
- Add a simple root landing page (static or React) that:
  - shows the world map entry
  - redirects to the circuit simulator when user selects a plant

### Option B (cleaner UX, still minimal change)
- Create a new lightweight React app: `apps/world-shell`
- It serves as:
  - main world map UI
  - router/navigation hub
- It opens legacy apps via:
  - links (`window.location`)
  - or iframe (only if acceptable)

### Deliverable
User can start in a single place and move into challenges without feeling like two unrelated apps.

---

## ✅ Phase 3 — “Power Plant Challenge” Bridge

### Goal
Selecting a nuclear plant on the map launches the correct circuit challenge.

### Tasks
1. Define a **shared challenge identifier**
   - Example: `plantId = "KRSKO_001"` or `plantId = "FR_FLAMANVILLE_1"`
2. On plant click, store selected plant:
   - simplest: query param (`/challenge?plantId=...`)
   - alternative: localStorage/sessionStorage
3. Circuit app reads `plantId` on load:
   - loads corresponding level/configuration

**Minimal change rule**: do not rewrite simulator; only add a small “load configuration by id” layer.

### Deliverable
Map → selects plant → simulator opens correct scenario.

---

## ✅ Phase 4 — Shared Scenario Data (Centralized Config, Minimal Code Impact)

### Goal
Make challenges data-driven without rewriting both systems.

### Approach
Introduce a **shared JSON configuration layer**.

Example structure:
- `shared/scenarios/nuclear-plants.json`
- contains:
  - plant metadata (name, country, output)
  - difficulty
  - simulator configuration (required components, demand, constraints)

### Integration approach
- Geo app uses this JSON for map display and tooltips.
- Circuit app uses the same JSON to configure levels.

This avoids complex backend merging and keeps both apps mostly unchanged.

### Deliverable
Single source of truth for plant data + level configs.

---

## ✅ Phase 5 — Optional: Progress + Attempts + “Destroyed Plant” State

### Goal
Implement failure consequences and progression while keeping apps separate.

### Tasks
- Add a lightweight progress service (small backend) **OR** reuse one backend minimally.
- Track:
  - attempts per `plantId`
  - completion status
  - destroyed status (boolean)
- Map UI:
  - if destroyed → show exploded marker/icon
  - if completed → show “powered” indicator

Circuit simulator:
- on failure → POST attempt result
- on success → POST completion result

### Deliverable
Unified game loop:
World map remembers your results and reacts visually.

---

## ✅ Phase 6 — UI Consistency Pass (Low Risk Changes)

### Goal
Make both apps feel like one product, without rewrites.

### Tasks (small but impactful)
- add shared theme constants:
  - colors, font, spacing
- unify navbar style / logo
- unify button styles
- add consistent loading/error screens

If you can’t share UI code, do it via:
- a shared CSS file
- or a small “branding” component copied into both apps

### Deliverable
Users don’t feel the seam between projects.

---

## ✅ Phase 7 — Hardening & Documentation

### Goal
Make the project easy to run, demo, and grade.

### Tasks
- Root README:
  - setup steps
  - port list
  - how to run all
  - how to create a new plant level (edit JSON)
- Add `.env.example` for each backend
- Add a simple “demo flow” section:
  1) pick plant
  2) build grid
  3) fail 3 times → explosion on map
  4) succeed → powered icon

### Deliverable
TA/professor can run it quickly and understand integration decisions.

---
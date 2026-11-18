# Airbnb Clone - Frontend Service

This is the decoupled frontend presentation service for the Airbnb Clone, built with **Express.js**, **EJS**, and **Tailwind CSS**.

## Architecture

- Renders all UI templates in `views/` using EJS.
- Serves static assets from `public/`.
- Seamlessly fetches data from the **Backend REST API** (`BACKEND_URL`).
- Proxies/streams uploaded home images and avatars from the backend.

---

## Environment Variables (`.env`)

```env
PORT=3000
BACKEND_URL=http://localhost:5000
SESSION_SECRET=airbnb-frontend-secret-key
```

When deployed to production (Render, Vercel, Railway), set `BACKEND_URL` to your live backend domain, e.g.:
```env
BACKEND_URL=https://airbnb-backend.onrender.com
```

---

## Local Setup

```bash
cd frontend
npm install
npm run dev     # Starts frontend on port 3000
# or
npm start
```

To build or watch Tailwind styles:
```bash
npm run build    # Compiles Tailwind into public/output.css
npm run tailwind # Watches for Tailwind changes
```

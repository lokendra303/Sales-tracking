# SalesTrack

Three apps. One API.

```
Sales Project/
  backend/    Node + Express + MySQL API
  frontend/   Manager and Admin web portal
  mobile/     Salesperson Android UI only
```

`mobile` and `frontend` have no database. They call the backend URL — local on this PC, or a live server later.

## Backend (this PC)

```bash
npm run backend:seed
npm run backend
```

API: http://localhost:3000

Demo password `Admin@123`:

- Admin `9999999999` — web portal
- Manager `7777777777` — web portal
- Sales `8888888888` — mobile app

## Frontend (manager / admin)

```bash
npm run frontend
```

Portal: http://localhost:5173  
Uses `frontend/.env` → `VITE_API_URL=http://localhost:3000`

## Mobile (salesperson UI)

```bash
npm run mobile
```

Set the server in `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.83:3000
```

Same Wi-Fi for a real phone. Later, point this at `https://your-domain`.

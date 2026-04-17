import express from "express";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Extend session type at top level
declare module "express-session" {
  interface SessionData {
    username?: string;
    loginTime?: string;
    profileVisitCount?: number;
  }
}

// Polyfill for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: "zalo-mini-secret-key",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false }, // Set to true if using HTTPS
    })
  );

  // --- API Routes ---

  // 3.1. Trang chủ / - Trả về thông tin theme
  app.get("/api/init", (req, res) => {
    const theme = req.cookies.theme || "light";
    const user = req.session.username || null;
    res.json({ theme, user });
  });

  // 3.2. Chức năng chọn theme bằng cookie
  app.get("/api/set-theme/:theme", (req, res) => {
    const { theme } = req.params;
    if (theme === "light" || theme === "dark") {
      res.cookie("theme", theme, { maxAge: 900000, httpOnly: true });
      return res.json({ success: true, theme });
    }
    res.status(400).json({ error: "Invalid theme. Use 'light' or 'dark'." });
  });

  // 3.3. Chức năng đăng nhập bằng session
  app.post("/api/login", (req, res) => {
    const { username } = req.body;
    if (username) {
      req.session.username = username;
      req.session.loginTime = new Date().toLocaleString();
      req.session.profileVisitCount = 0;
      return res.json({ success: true, user: username });
    }
    res.status(400).json({ error: "Username is required" });
  });

  // 3.4. Trang cá nhân /profile
  app.get("/api/profile", (req, res) => {
    if (!req.session.username) {
      return res.status(401).json({ error: "Unauthorized. Please login." });
    }
    
    // Increment visit count
    req.session.profileVisitCount = (req.session.profileVisitCount || 0) + 1;
    
    res.json({
      username: req.session.username,
      loginTime: req.session.loginTime,
      visits: req.session.profileVisitCount,
    });
  });

  // 3.5. Chức năng đăng xuất
  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Could not log out" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  // --- Vite / Frontend Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

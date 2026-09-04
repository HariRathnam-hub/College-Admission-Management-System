import "express-async-errors";
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "@/config/env";
import routes from "@/routes";
import { errorHandler, notFoundHandler } from "@/middlewares/error.middleware";

const app: Application = express();

// Security headers
app.use(helmet());

// CORS — allow the Next.js frontend, with credentials for refresh-token cookie
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Body & cookie parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

// Basic rate limiting (tuned further per-route in later phases, e.g. auth endpoints)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// API routes
app.use("/api/v1", routes);

// 404 + centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

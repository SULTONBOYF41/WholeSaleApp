import express from "express";
import cors from "cors";
import morgan from "morgan";
import { apiRouter } from "./routes";
import { errorMiddleware } from "./middleware/error";

export function createApp() {
    const app = express();
    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json({ limit: "2mb" }));
    app.use(morgan("combined"));

    app.use("/api", apiRouter);

    app.use(errorMiddleware);
    return app;
}

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { teamsRouter } from "./modules/teams/teams.routes.js";
import { devicesRouter } from "./modules/devices/devices.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { crmRouter } from "./modules/crm/crm.routes.js";
import { beatRouter } from "./modules/beat/beat.routes.js";
import { visitsRouter } from "./modules/visits/visits.routes.js";
import { fieldRouter } from "./modules/field/field.routes.js";
import { salesRouter } from "./modules/sales/sales.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { registrationsRouter } from "./modules/registrations/registrations.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { ok: true, service: "salestrack-api" } });
  });

  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/teams", teamsRouter);
  app.use("/devices", devicesRouter);
  app.use("/settings", settingsRouter);
  app.use("/registrations", registrationsRouter);
  app.use(crmRouter);
  app.use(beatRouter);
  app.use(visitsRouter);
  app.use(fieldRouter);
  app.use(salesRouter);
  app.use(reportsRouter);

  app.use(errorHandler);
  return app;
}

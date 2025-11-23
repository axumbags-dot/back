import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testDBConnection } from "./config/db.js";
import morgan from "morgan";
import Fhr from "./main/fhroute.js";

dotenv.config();

// Try a quick DB connection test on startup to surface config issues early
testDBConnection();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(morgan("dev"));
app.use(cors({ origin: '*' }));

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});



app.get("/", (req, res) => {
  res.send("Started");
});

app.use("/api", Fhr);

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

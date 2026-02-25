import app from "./app.js";
import { port } from "./config.js";
app.listen(port, () => {
    console.log(`GymTracker backend listening on http://localhost:${port}`);
});

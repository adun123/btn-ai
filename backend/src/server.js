require('dotenv').config();

const { app } = require('./app');

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`BTN KPR backend listening on http://localhost:${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});

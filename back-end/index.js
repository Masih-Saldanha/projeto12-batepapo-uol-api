import express from "express";
import cors from "cors";
const PORTA = 5000;

const app = express();
app.use(cors());
app.use(express.json());

app.listen(PORTA, () => {
    console.log(`Servidor ligado na porta ${PORTA}`);
});
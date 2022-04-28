import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
// console.log(mongoClient);
let db;

const app = express();
app.use(cors());
app.use(json());

app.listen(process.env.PORTA, () => {
    console.log(`Servidor ligado na porta ${process.env.PORTA}`);
});
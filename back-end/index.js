import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import schema from "back-end/schema.js"
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

const app = express();
app.use(cors());
app.use(json());

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE)

        await db.collection("participants").insertOne({ name, lastStatus: Date.now() });
        // if (!name) {
        //     return res.sendStatus()
        // }
        res.sendStatus(201);

        mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        mongoClient.close();
    }
})

app.listen(process.env.PORTA, () => {
    console.log(`Servidor ligado na porta ${process.env.PORTA}`);
});
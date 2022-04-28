import schema from "./schema.js"
import express, { json } from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

const app = express();
app.use(cors());
app.use(json());

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const lastStatus = Date.now();

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE)

        const isNameOnList = await db.collection("participants").findOne({ name });
        if (isNameOnList && name) {
            console.log(`Usuário ${name} Já existe!`);
            return res.sendStatus(409)
        };

        const verification = await schema.validateAsync({ name, lastStatus });
        if (verification) {
            console.log(`Usuário ${name} criado com sucesso!`);
            await db.collection("participants").insertOne({ name, lastStatus });
            await db.collection("messages").insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format("HH:mm:ss")});
        }

        res.sendStatus(201);

        mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        mongoClient.close();
    }
})

app.get("/participants", async (req, res) => {
    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const participants = await db.collection("participants").find().toArray();
        res.send(participants);

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
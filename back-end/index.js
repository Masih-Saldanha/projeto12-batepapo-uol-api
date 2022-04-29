import participantValidation from "./participantValidation.js"
import messageValidation from "./messageValidation.js"
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

// ADIÇÃO DE PARTICIPANTE AO CHAT
app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const lastStatus = Date.now();

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE)

        const isNameOnList = await db.collection("participants").findOne({ name });
        if (isNameOnList) {
            console.log(`Usuário ${name} Já existe!`);
            return res.sendStatus(409)
        };

        const verification = await participantValidation.validateAsync({ name, lastStatus });
        if (verification) {
            await db.collection("participants").insertOne({ name, lastStatus });
            await db.collection("messages").insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format("HH:mm:ss") });
        }
        
        console.log(`Usuário ${name} criado com sucesso!`);
        res.sendStatus(201);

        mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        mongoClient.close();
    }
})

// DEVOLVE LISTA DE PARTICIPANTES DO CHAT
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

// ATUALIZAÇÃO DE STATUS DO PARTICIPANTE DO CHAT
app.post("/status", async (req, res) => {
    const { user } = req.headers;

    try {
        mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const isParticipantOnList = await db.collection("participants").findOne({ name: user });
        if (!isParticipantOnList) {
            return res.sendStatus(404);
        }

        await db.collection("participants").updateOne(
            { name: user },
            { $set: { lastStatus: Date.now() } }
        )

        res.sendStatus(200);

        mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        mongoClient.close();
    }
})

// ADIÇÃO DE MENSAGEM AO CHAT
app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers; // "USER" SE ATRIBUI À "FROM"

    // const lastStatus = Date.now();

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE)

        const isNameOnList = await db.collection("participants").findOne({ name: user });
        if (!isNameOnList) {
            console.log(`Usuário ${user} não está na lista/chat!`);
            return res.sendStatus(404)
        };

        const verification = await messageValidation.validateAsync({ to, text, type, from: user });
        if (verification) {
            console.log(`Mensagem de ${user} para ${to} passou nos testes com sucesso!`);
            await db.collection("messages").insertOne({ from: user, to, text, type, time: dayjs(Date.now()).format("HH:mm:ss") });
        }

        console.log(`Mensagem de ${user} para ${to} enviada com sucesso!`);
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
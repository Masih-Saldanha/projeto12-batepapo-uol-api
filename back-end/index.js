import participantSchema from "./participantSchema.js";
import messageSchema from "./messageSchema.js";
import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";
import dotenv from "dotenv";
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

const app = express();
app.use(cors());
app.use(json());

// REMOÇÃO AUTOMÁTICA DE PARTICIPANTES INATIVOS
setInterval(async () => {
    try {
        mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const lastStatus = Date.now();
        const participants = await db.collection("participants").find().toArray();

        const filteredParticipants = participants.filter(participant => {
            if (
                parseInt(participant.lastStatus) + 10000 <= parseInt(lastStatus)
            ) {
                return participant;
            }
        })

        if (filteredParticipants.length > 0) {
            filteredParticipants.map(participant => {
                db.collection("participants").deleteOne({ name: participant.name });
                db.collection("messages").insertOne({ from: participant.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs(lastStatus).format("HH:mm:ss") });
                console.log(`Usuário ${participant.name} retirado da sala por inatividade!`);
            })
        }

        // mongoClient.close();
    } catch (e) {
        console.error(e);

        // mongoClient.close();
    }
}, 15000);

// ADIÇÃO DE PARTICIPANTE AO CHAT
app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const lastStatus = Date.now();

    const sanitizedName = stripHtml(name).result.trim();

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const isNameOnList = await db.collection("participants").findOne({ name: sanitizedName });
        if (isNameOnList) {
            console.log(`Usuário ${sanitizedName} Já existe!`);
            return res.sendStatus(409);
        };

        const verification = await participantSchema.validateAsync({ name: sanitizedName, lastStatus });
        if (!verification.error) {
            await db.collection("participants").insertOne({ name: sanitizedName, lastStatus });
            await db.collection("messages").insertOne({ from: sanitizedName, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs(lastStatus).format("HH:mm:ss") });
        } else {
            return res.sendStatus(422);
        }

        console.log(`Usuário ${sanitizedName} criado com sucesso!`);
        res.status(201).send(sanitizedName);

        // mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        // mongoClient.close();
    }
});

// DEVOLVE LISTA DE PARTICIPANTES DO CHAT
app.get("/participants", async (req, res) => {
    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const participants = await db.collection("participants").find().toArray();
        res.send(participants);

        // mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        // mongoClient.close();
    }
});

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

        // mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        // mongoClient.close();
    }
});

// ADIÇÃO DE MENSAGEM AO CHAT
app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers; // "USER" SE ATRIBUI À "FROM"

    const sanitizedTo = stripHtml(to).result.trim();
    const sanitizedText = stripHtml(text).result.trim();
    const sanitizedType = stripHtml(type).result.trim(); // Provavelmente não precisa mas fiz por precaução
    const sanitizedUser = stripHtml(user).result.trim();

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const isNameOnList = await db.collection("participants").findOne({ name: sanitizedUser });
        if (!isNameOnList) {
            console.log(`Usuário ${sanitizedUser} não está na lista/chat!`);
            return res.sendStatus(404);
        };

        const verification = await messageSchema.validateAsync({ to: sanitizedTo, text: sanitizedText, type: sanitizedType, from: sanitizedUser });
        if (!verification.error) {
            console.log(`Mensagem de ${sanitizedUser} para ${sanitizedTo} passou nos testes com sucesso!`);
            await db.collection("messages").insertOne({ from: sanitizedUser, to: sanitizedTo, text: sanitizedText, type: sanitizedType, time: dayjs(Date.now()).format("HH:mm:ss") });
        } else {
            return res.sendStatus(422);
        }

        console.log(`Mensagem de ${sanitizedUser} para ${sanitizedTo} enviada com sucesso!`);
        res.sendStatus(201);

        // mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        // mongoClient.close();
    }
});

// DEVOLVE LISTA DE MENSAGENS DO CHAT
app.get("/messages", async (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const isUserOnCollectionTo = await db.collection("messages").findOne({ to: user });
        const isUserOnCollectionFrom = await db.collection("messages").findOne({ from: user });
        if (!isUserOnCollectionTo && !isUserOnCollectionFrom) {
            return res.sendStatus(404);
        }

        function messageFilter(messageArrayData, comparator) {
            if (!messageArrayData) return true;
            return messageArrayData === comparator;
        }

        const allMessages = await db.collection("messages").find().toArray();
        const filteredMessages = allMessages.filter(message => {
            return messageFilter(message.type, "status")
                || messageFilter(message.type, "message")
                || (messageFilter(message.to, user) && messageFilter(message.type, "private_message"))
                || (messageFilter(message.from, user) && messageFilter(message.type, "private_message"));
        });

        const showMessages = filteredMessages.slice(filteredMessages.length - limit, filteredMessages.length);

        if (!limit) {
            return res.send(filteredMessages);
        }

        res.send(showMessages);

        // mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        // mongoClient.close();
    }
});

// BONUS:

// DELETAR MENSAGEM DO USUARIO:
app.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const ID_DA_MENSAGEM = req.params.ID_DA_MENSAGEM;
    const { user } = req.headers;

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const isMessageIdOnList = await db.collection("messages").findOne({ _id: new ObjectId(ID_DA_MENSAGEM) });
        if (!isMessageIdOnList) {
            console.log("ID passada não consta na lista de mensagens!");
            return res.sendStatus(404);
        }

        if (isMessageIdOnList.from !== user) {
            console.log("Usuário não é o mesmo da mensagem que deseja apagar!");
            return res.sendStatus(401);
        }

        await db.collection("messages").deleteOne({ _id: new ObjectId(ID_DA_MENSAGEM) });
        res.sendStatus(200);

        // mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        // mongoClient.close();
    }
});

// EDIÇÃO DE MENSAGEM NO CHAT
app.put("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers; // "USER" SE ATRIBUI À "FROM"
    const ID_DA_MENSAGEM = req.params.ID_DA_MENSAGEM;

    const sanitizedTo = stripHtml(to).result.trim();
    const sanitizedText = stripHtml(text).result.trim();
    const sanitizedType = stripHtml(type).result.trim(); // Provavelmente não precisa mas fiz por precaução
    const sanitizedUser = stripHtml(user).result.trim();

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const isNameOnList = await db.collection("participants").findOne({ name: user });
        if (!isNameOnList) {
            console.log(`Usuário ${user} não está na lista/chat!`);
            return res.sendStatus(404);
        };

        const isMessageIdOnList = await db.collection("messages").findOne({ _id: new ObjectId(ID_DA_MENSAGEM) });
        if (!isMessageIdOnList) {
            console.log("ID passada não consta na lista de mensagens!");
            return res.sendStatus(404);
        };

        if (isMessageIdOnList.from !== user) {
            console.log("Usuário não é o mesmo da mensagem que deseja apagar!");
            return res.sendStatus(401);
        }

        const verification = await messageSchema.validateAsync({ to: sanitizedTo, text: sanitizedText, type: sanitizedType, from: sanitizedUser });
        if (!verification.error) {
            console.log(`Mensagem de ${sanitizedUser} para ${sanitizedTo} passou nos testes com sucesso!`);
            await db.collection("messages").updateOne({ _id: new ObjectId(ID_DA_MENSAGEM) }, { $set: { to: sanitizedTo, text: sanitizedText, type: sanitizedType } });
        } else {
            return res.sendStatus(422);
        }

        console.log(`Mensagem de ${user} para ${to} editada com sucesso!`);
        res.sendStatus(201);

        // mongoClient.close();
    } catch (e) {
        console.error(e);
        res.sendStatus(422);

        // mongoClient.close();
    }
});

app.listen(process.env.PORTA, () => {
    console.log(`Servidor ligado na porta ${process.env.PORTA}`);
});
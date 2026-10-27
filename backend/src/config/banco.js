import { MongoClient } from "mongodb";

export async function conectar({ uri, banco }) {
  const cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: "escape-py-api" });
  await cliente.connect();
  const db = cliente.db(banco);
  await db.command({ ping: 1 });
  return { cliente, db };
}

// Índices criados na inicialização; createIndex não faz nada se o índice já existir
export async function criarIndices(db) {
  const texto = { $type: "string" };
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ usernameLower: 1 }, { unique: true, partialFilterExpression: { usernameLower: texto } }),
    db.collection("users").createIndex({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: texto } }),
    db.collection("users").createIndex({ firebaseUid: 1 }, { unique: true, partialFilterExpression: { firebaseUid: texto } }),

    db.collection("authTokens").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("authTokens").createIndex({ userId: 1, type: 1 }),
    db.collection("authTokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    db.collection("groups").createIndex({ members: 1 }),
    db.collection("invites").createIndex({ toUid: 1, status: 1 }),
    db.collection("invites").createIndex({ fromUid: 1 }),
    db.collection("invites").createIndex({ groupId: 1 }),
    db.collection("messages").createIndex({ groupId: 1, createdAt: -1 }),
    db.collection("messages").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("auditLogs").createIndex({ at: -1 })
  ]);
}

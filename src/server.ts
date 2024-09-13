import Aedes, {
  AuthenticateError,
  AuthErrorCode,
  Client,
  PublishPacket,
} from "aedes";
import * as net from "net";
import * as http from "http";
import * as WebSocket from "ws";

const PORT = 1883;
const WEBSOCKET_PORT = 8888;

interface ClientSimple {
  id: string;
  username: string;
}
let clientsConnected: ClientSimple[] = [];

// Créer un broker Aedes
const broker: Aedes = new Aedes();

// Configurer le serveur TCP MQTT
const server = net.createServer(broker.handle);

// Écouter sur le port MQTT standard
server.listen(PORT, () => {
  console.log(`Serveur MQTT démarré sur le port ${PORT}`);
});

// Créer un serveur HTTP pour gérer les WebSockets
const httpServer = http.createServer();
const wss = new WebSocket.WebSocketServer({ server: httpServer });

// Configurer WebSocket pour utiliser Aedes
wss.on("connection", (ws: WebSocket) => {
  const stream = WebSocket.createWebSocketStream(ws);
  broker.handle(stream);
});

httpServer.listen(WEBSOCKET_PORT, () => {
  console.log(`Serveur WebSocket démarré sur le port ${WEBSOCKET_PORT}`);
});

// Authentification
broker.authenticate = function (client, username, password, callback) {
  if (
    clientsConnected.findIndex((val) => {
      return val?.username == username;
    }) != -1
  ) {
    const error: AuthenticateError = {
      returnCode: AuthErrorCode.BAD_USERNAME_OR_PASSWORD,
      name: "Auth Error",
      message: "There was an error during the authentification",
      stack: "Coucou",
    };
    console.warn(
      "authError",
      `Le client ${username} (${client.id}) a tenté de se connecter`
    );
    callback(error, false);
  } else {
    clientsConnected.push({ id: client.id, username: username ?? "" });
    console.warn(
      "authSuccess",
      `Le client ${username} (${client.id}) s'est connecté`
    );
    callback(null, true);
  }
};

// Gérer les événements de connexion, publication et abonnement
broker.on("client", (client: Client) => {
  console.log("client", `Client connecté : ${client.id}`, clientsConnected);
});

broker.on("clientError", (client: Client, error: Error) => {
  console.log(
    "clientError",
    "Erreur avec le client " + client.id + " : " + error.message
  );
});

broker.on("connectionError", (client: Client, error: Error) => {
  console.log(
    "connectionError",
    "Erreur avec le client " + client.id + " : " + error.message
  );
});

broker.on("clientDisconnect", (client) => {
  clientsConnected = clientsConnected.filter((val) => val.id != client.id);
  console.log(`Le client ${client?.id} s'est déconnecté`, clientsConnected);
});

broker.on("publish", (packet, client) => {
  if (client?.id) {
    console.log(
      `Message publié par (${client?.id}) sur le topic ${
        packet.topic
      }: ${packet.payload.toString()} => ${packet.qos}`
    );
  } else {
    console.log("Heartbeat : " + packet.payload.toString());
  }
});

broker.on("subscribe", (subscriptions, client: Client) => {
  console.log(
    `Client ${client?.id} s'est abonné à ${subscriptions
      .map((sub) => sub.topic)
      .join(", ")}`
  );
  let packet: PublishPacket = {
    topic: subscriptions[subscriptions.length - 1].topic,
    payload: `Un client ${
      clientsConnected.filter((val) => val.id == client.id)[0].username
    } s'est connecté`,
    cmd: "publish",
    qos: 0,
    dup: false,
    retain: false,
  };
  console.log("Packet", packet);
  broker.publish(packet, (error) => {
    console.error(error, "Une erreur est survenue");
  });
});

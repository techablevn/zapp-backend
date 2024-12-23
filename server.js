// === Backend (Node.js + Express) ===
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const { verify } = require("jsonwebtoken");
const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");
const app = express();
const AppError = require("./utils/appError");

// Load environment variables
dotenv.config();

// Middleware
app.use(bodyParser.json());

const authConfig = require("./config/auth.config.js");

// Redis connection configuration
const redisClient = new Redis({
  host: authConfig.redis.host || "127.0.0.1",
  port: authConfig.redis.port || 6379,
  username: authConfig.redis.user,
  password: authConfig.redis.pass || null,
});

// Handle Redis connection events
redisClient.on("connect", () => {
  console.log("Connected to Redis");
  redisClient.auth(authConfig.redis.auth, (err, response) => {
    if (err) {
      console.error("Redis AUTH failed:", err);
    } else {
      console.log("Authenticated to Redis successfully");
    }
  });
});
redisClient.on("error", (err) => console.error("Redis error:", err));

// HTTP Server for Backend API
const apiServer = http.createServer(app);

// Start API Server
const PORT = process.env.PORT || 3000;
apiServer.listen(PORT, () => {
  console.log(`Backend API running at http://localhost:${PORT}`);
});

// Separate Socket.IO Server
const socketIoServer = http.createServer();
const io = new Server(socketIoServer, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

// Save a socket connection
const saveConnection = async (tenantId, socketId) => {
  const key = `tenant:${tenantId}:connections`;
  const value = { socketId };
  await redisClient.hset(key, socketId, JSON.stringify(value));

};

// Middleware xác thực JWT cho Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth?.token; // Lấy token từ auth payload
  if (!token) return next(new AppError("Authentication token required", 403));

  // Xác thực token
  verify(token, authConfig.secret, (err, user) => {
    if (err) return next(new AppError("Invalid or expired token", 401));
    socket.user = user; // Lưu thông tin user vào socket
    console.log(user);
    next();
  });
});

// Socket.io event handlers
io.on("connection", async (socket) => {
  console.log(`${socket.user.name} connected`);

  const { tenantId } = socket.handshake.query;
  if (!tenantId) {
    console.error("Tenant ID is required for socket connection");
    socket.disconnect();
    return;
  }

  console.log(`New connection: Tenant ${tenantId}, Socket ${socket.id}`);

  // Save connection in Redis
  //await saveConnection(tenantId, socket.id);

  //await redisClient.del('tenant:1:connections');
  const key = `tenant:${tenantId}:connections`;
  const tenants = await redisClient.hgetall(key);
  console.log(tenants);

  socket.on("typing", ({ conversationId, isTyping }) => {
    socket.to(conversationId).emit("typing", { isTyping });
  });

  // Ví dụ: gửi thông báo khi có master data update
  socket.on("getMasterData", async () => {
    socket.emit("masterDataResponse", { message: "Master data updated" });
  });

  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.user.name);
  });
});

// Start server
const PORT_SOCKET = process.env.PORT_SOCKET || 3000;
socketIoServer.listen(PORT_SOCKET, () => {
  console.log(`Socket.IO server running at http://localhost:${PORT_SOCKET}`);
});

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config(); // Load environment variables

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/secureChat", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const User = require("./models/User");

// Secret key for JWT
const JWT_SECRET = "your_jwt_secret"; 

// User Signup
app.post("/signup", async (req, res) => {
    try {
        const { username, password, publicKey } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ username, password: hashedPassword, publicKey });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error registering user" });
    }
});

// User Login
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: "1h" });

        res.json({ token, publicKey: user.publicKey });
    } catch (error) {
        res.status(500).json({ error: "Error logging in" });
    }
});

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("sendMessage", async ({ sender, receiver, encryptedMessage }) => {
        io.to(receiver).emit("receiveMessage", { sender, encryptedMessage });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

const { encryptMessage, decryptMessage } = require("./utils/cryptoUtils");

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("sendMessage", async ({ sender, receiver, message, key }) => {
        const encryptedData = encryptMessage(message, key);
        io.to(receiver).emit("receiveMessage", { sender, encryptedData });
    });

    socket.on("decryptMessage", async ({ encryptedData, key }) => {
        const decryptedMessage = decryptMessage(encryptedData, key);
        socket.emit("messageDecrypted", { decryptedMessage });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
    });
});

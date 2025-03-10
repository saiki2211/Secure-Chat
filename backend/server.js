require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const svgCaptcha = require("svg-captcha");
const User = require("./models/User");
const Message = require("./models/Message");
const { encryptMessage, decryptMessage, signMessage, verifySignature } = require("./utils/cryptoUtils");
const { generateKeyPair } = require("./utils/cryptoUtils");

const app = express();
const server = http.createServer(app);

// Basic middleware
app.use(express.json());

// Debug middleware - MUST come first
app.use((req, res, next) => {
    console.log('=== Incoming Request ===');
    console.log(`${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    next();
});

// CORS configuration - Must come before session
app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));

// Add debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: true,
    saveUninitialized: true,
    name: 'connect.sid',
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/'
    }
}));

// Add debug middleware for session tracking
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session Data:', req.session);
    next();
});

// Socket.IO configuration
const io = new Server(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/secure-chat", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("MongoDB Connected"))
  .catch(err => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
});

// CAPTCHA endpoint
app.get("/captcha", (req, res) => {
    try {
        const captcha = svgCaptcha.create({
            size: 4,
            noise: 1,
            color: true,
            width: 150,
            height: 50,
            fontSize: 50,
            background: '#f0f0f0',
            charPreset: '123456789ABCDEFGHIJKLMNPQRSTUVWXYZ'
        });

        req.session.captcha = captcha.text;
        console.log('Generated CAPTCHA:', captcha.text);
        
        const base64Data = Buffer.from(captcha.data).toString('base64');
        res.json({ 
            captcha: base64Data,
            text: process.env.NODE_ENV === 'development' ? captcha.text : undefined
        });
    } catch (error) {
        console.error('CAPTCHA generation error:', error);
        res.status(500).json({ error: 'Failed to generate CAPTCHA' });
    }
});

// User Registration with error handling
app.post("/register", async (req, res) => {
    try {
        const { username, password, publicKey, captcha } = req.body;
        
        // Verify CAPTCHA
        if (!req.session?.captcha || captcha.toLowerCase() !== req.session.captcha.toLowerCase()) {
            return res.status(400).json({ error: "Invalid CAPTCHA" });
        }

        if (await User.findOne({ username })) {
            return res.status(400).json({ error: "Username already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, publicKey });
        await newUser.save();
        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: "Error registering user" });
    }
});

// Login endpoint
app.post("/login", async (req, res) => {
    try {
        const { username, password, captcha } = req.body;
        console.log('Login attempt with CAPTCHA:', captcha);
        console.log('Stored CAPTCHA:', req.session.captcha);

        // Basic validation
        if (!username || !password || !captcha) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Verify CAPTCHA
        if (!req.session?.captcha) {
            return res.status(400).json({ error: "Session expired" });
        }

        if (captcha.toUpperCase() !== req.session.captcha.toUpperCase()) {
            return res.status(400).json({ error: "Invalid CAPTCHA" });
        }

        // Clear CAPTCHA after verification
        req.session.captcha = null;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || "your_jwt_secret",
            { expiresIn: "1h" }
        );

        res.json({
            token,
            user: {
                username: user.username,
                id: user._id,
                publicKey: user.publicKey
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// Get user details from token with proper error handling
app.get("/user", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Invalid authorization header" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
        const user = await User.findById(decoded.id).select("username publicKey");
        if (!user) return res.status(404).json({ error: "User not found" });
        
        res.json(user);
    } catch (error) {
        console.error("User details error:", error);
        res.status(401).json({ error: "Invalid token" });
    }
});

// Key generation endpoint
app.post("/generate-keys", async (req, res) => {
    try {
        const { publicKey, privateKey } = await generateKeyPair();
        res.json({ publicKey, privateKey });
    } catch (error) {
        console.error("Key generation error:", error);
        res.status(500).json({ error: "Error generating keys" });
    }
});

// Get all users endpoint
app.get("/users", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Invalid authorization header" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
        
        // Get all users except the current user
        const users = await User.find({ _id: { $ne: decoded.id } })
            .select("username _id");
        
        res.json(users);
    } catch (error) {
        console.error("Users list error:", error);
        res.status(401).json({ error: "Invalid token" });
    }
});

// Socket.io for real-time chat with error handling
io.on("connection", async (socket) => {
    console.log("User connected:", socket.id);
    let currentUser = null;

    try {
        // Verify token
        const token = socket.handshake.auth.token;
        if (!token) {
            socket.disconnect();
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
        const user = await User.findById(decoded.id);
        if (!user) {
            socket.disconnect();
            return;
        }

        currentUser = user;

        // Join user's own room
        socket.join(user._id.toString());
        
        // Broadcast user's online status
        socket.broadcast.emit('userStatus', {
            userId: user._id,
            status: 'online'
        });

        // Send previous messages to new users
        const previousMessages = await Message.find({
            $or: [
                { sender: user._id },
                { receiver: user._id }
            ]
        })
        .sort({ timestamp: -1 })
        .limit(50);
        
        socket.emit("previousMessages", previousMessages);

        // Send current online users
        const onlineUsers = Array.from(io.sockets.sockets.values())
            .map(s => s.currentUser?._id.toString())
            .filter(id => id && id !== user._id.toString());
        
        socket.emit('onlineUsers', onlineUsers);

        // Handle messages
        socket.on("sendMessage", async (data) => {
            try {
                // Verify message integrity
                const isValidSignature = verifySignature(
                    data.content.encrypted,
                    data.content.signature,
                    user.publicKey
                );

                if (!isValidSignature) {
                    throw new Error("Invalid message signature");
                }

                const message = new Message({
                    sender: user._id,
                    receiver: data.receiver,
                    content: data.content,
                    timestamp: Date.now()
                });
                
                await message.save();
                
                // Emit to specific receiver's room
                io.to(data.receiver).emit("receiveMessage", {
                    _id: message._id,
                    sender: user._id,
                    receiver: data.receiver,
                    content: data.content,
                    timestamp: message.timestamp
                });

                // Also emit to sender's room if they're not the receiver
                if (data.receiver !== user._id.toString()) {
                    socket.emit("receiveMessage", {
                        _id: message._id,
                        sender: user._id,
                        receiver: data.receiver,
                        content: data.content,
                        timestamp: message.timestamp
                    });
                }
            } catch (error) {
                console.error("Message sending error:", error);
                socket.emit("error", { message: "Error sending message" });
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
            if (currentUser) {
                // Broadcast user's offline status
                socket.broadcast.emit('userStatus', {
                    userId: currentUser._id,
                    status: 'offline'
                });
            }
        });

    } catch (error) {
        console.error("Socket connection error:", error);
        socket.emit("error", { message: "Connection error" });
        socket.disconnect();
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

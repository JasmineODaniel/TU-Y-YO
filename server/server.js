const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Higher limit for profile pics

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.log("MongoDB error ❌", err));

// Models
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  display_name: { type: String, required: true },
  password: { type: String, required: true },
  public_key: { type: String, required: true },
  wrapped_private_key: { type: String, required: true },
  pbkdf2_salt: { type: String, required: true },
  profilePic: { type: String, default: "" },
  created_at: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  from_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payload: { type: String, required: true }, // Encrypted payload
  created_at: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false }
});

const User = mongoose.model("User", UserSchema);
const Message = mongoose.model("Message", MessageSchema);

// Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ detail: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ detail: "Invalid token" });
  }
};

// Auth Routes
app.post("/auth/register", async (req, res) => {
  try {
    const { username, display_name, password, public_key, wrapped_private_key, pbkdf2_salt } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, display_name, password: hashedPassword, public_key, wrapped_private_key, pbkdf2_salt });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
    res.json({ access_token: token, expires_in: 604800, user: { id: user._id, username, display_name, public_key, wrapped_private_key, pbkdf2_salt } });
  } catch (err) {
    res.status(400).json({ detail: "Registration failed: " + err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ detail: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" });
    res.json({ access_token: token, expires_in: 604800, user: { id: user._id, username: user.username, display_name: user.display_name, public_key: user.public_key, wrapped_private_key: user.wrapped_private_key, pbkdf2_salt: user.pbkdf2_salt, profilePic: user.profilePic } });
  } catch (err) {
    res.status(400).json({ detail: "Login failed" });
  }
});

app.get("/auth/me", authenticate, async (req, res) => {
  const user = await User.findById(req.userId).select("-password");
  res.json({ id: user._id, username: user.username, display_name: user.display_name, profilePic: user.profilePic });
});

// User Routes
app.get("/users/search", authenticate, async (req, res) => {
  const { q } = req.query;
  const users = await User.find({ 
    $or: [
      { username: { $regex: q, $options: "i" } },
      { display_name: { $regex: q, $options: "i" } }
    ],
    _id: { $ne: req.userId }
  }).select("display_name username profilePic _id");
  res.json(users.map(u => ({ id: u._id, username: u.username, display_name: u.display_name, profilePic: u.profilePic })));
});

app.get("/users/:id/public-key", authenticate, async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json({ public_key: user.public_key });
});

app.post("/users/profile-pic", authenticate, async (req, res) => {
  try {
    const { profilePic } = req.body;
    await User.findByIdAndUpdate(req.userId, { profilePic });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ detail: "Failed to update profile picture" });
  }
});

// Conversation Routes
app.get("/conversations", authenticate, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ from_user_id: req.userId }, { to_user_id: req.userId }]
    }).sort({ created_at: -1 });

    const partners = new Set();
    const convos = [];
    for (const msg of messages) {
      const partnerId = msg.from_user_id.toString() === req.userId ? msg.to_user_id : msg.from_user_id;
      if (!partners.has(partnerId.toString())) {
        partners.add(partnerId.toString());
        const user = await User.findById(partnerId);
        convos.push({
          user_id: user._id,
          display_name: user.display_name,
          username: user.username,
          profile_pic: user.profilePic,
          last_message_at: msg.created_at
        });
      }
    }
    res.json(convos);
  } catch (err) {
    res.status(500).json({ detail: "Failed to load conversations" });
  }
});

app.get("/conversations/:userId/messages", authenticate, async (req, res) => {
  const messages = await Message.find({
    $or: [
      { from_user_id: req.userId, to_user_id: req.params.userId },
      { from_user_id: req.params.userId, to_user_id: req.userId }
    ]
  }).sort({ created_at: 1 });
  res.json(messages.map(m => ({
    id: m._id,
    from_user_id: m.from_user_id,
    to_user_id: m.to_user_id,
    payload: m.payload,
    created_at: m.created_at,
    delivered: m.delivered
  })));
});

// Socket.io Logic
const userSockets = new Map();
io.on("connection", (socket) => {
  const token = socket.handshake.auth.token;
  if (!token) return socket.disconnect();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    userSockets.set(decoded.id, socket.id);
    socket.emit("connection", { status: "connected" });

    socket.on("message.send", async (data) => {
      const { to, payload } = data;
      const msg = new Message({ from_user_id: decoded.id, to_user_id: to, payload });
      await msg.save();
      
      const recipientSocketId = userSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("message", {
          id: msg._id,
          from_user_id: decoded.id,
          to_user_id: to,
          payload,
          created_at: msg.created_at
        });
      }
      // Send back to sender for sync
      socket.emit("message", {
        id: msg._id,
        from_user_id: decoded.id,
        to_user_id: to,
        payload,
        created_at: msg.created_at
      });
    });

    socket.on("disconnect", () => {
      userSockets.delete(decoded.id);
    });
  } catch (err) {
    socket.disconnect();
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
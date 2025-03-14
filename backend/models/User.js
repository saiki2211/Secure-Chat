const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    publicKey: { type: String, required: true } // Store user's RSA public key
});

module.exports = mongoose.model("User", UserSchema);

const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    receiver: { type: String, required: true },
    content: {
        encrypted: { type: String, required: true },
        iv: { type: String, required: true },
        hash: { type: String, required: true },
        signature: { type: String, required: true }
    },
    timestamp: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    backup: {
        type: Boolean,
        default: false
    }
});

// Index for faster queries
MessageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
MessageSchema.index({ status: 1 });

module.exports = mongoose.model("Message", MessageSchema); 
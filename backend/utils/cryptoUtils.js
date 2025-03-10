const crypto = require("crypto");

function generateKeyPair() {
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair("rsa", {
            modulusLength: 2048,
            publicKeyEncoding: { type: "spki", format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" }
        }, (err, publicKey, privateKey) => {
            if (err) reject(err);
            else resolve({ publicKey, privateKey });
        });
    });
}

function encryptMessage(message, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
    let encrypted = cipher.update(message, "utf-8", "hex");
    encrypted += cipher.final("hex");
    
    // Generate HMAC for message integrity
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(message);
    const messageHash = hmac.digest("hex");
    
    return { 
        iv: iv.toString("hex"), 
        encrypted,
        hash: messageHash,
        timestamp: Date.now()
    };
}

function decryptMessage(encryptedData, key) {
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), Buffer.from(encryptedData.iv, "hex"));
    let decrypted = decipher.update(encryptedData.encrypted, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    
    // Verify message integrity
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(decrypted);
    const messageHash = hmac.digest("hex");
    
    if (messageHash !== encryptedData.hash) {
        throw new Error("Message integrity check failed");
    }
    
    // Verify timestamp (prevent replay attacks)
    const messageAge = Date.now() - encryptedData.timestamp;
    if (messageAge > 5 * 60 * 1000) { // 5 minutes
        throw new Error("Message too old");
    }
    
    return decrypted;
}

function signMessage(message, privateKey) {
    const sign = crypto.createSign("SHA256");
    sign.update(message);
    return sign.sign(privateKey, "hex");
}

function verifySignature(message, signature, publicKey) {
    const verify = crypto.createVerify("SHA256");
    verify.update(message);
    return verify.verify(publicKey, signature, "hex");
}

module.exports = { 
    generateKeyPair, 
    encryptMessage, 
    decryptMessage,
    signMessage,
    verifySignature
};

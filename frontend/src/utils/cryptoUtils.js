import CryptoJS from 'crypto-js';

// Generate a random AES key
export const generateAESKey = () => {
    return CryptoJS.lib.WordArray.random(32).toString();
};

// Encrypt message using AES
export const encryptMessage = (message, key) => {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(message, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
    });
    
    // Generate HMAC
    const hmac = CryptoJS.HmacSHA256(message, key);
    
    return {
        encrypted: encrypted.toString(),
        iv: iv.toString(),
        hash: hmac.toString(),
        timestamp: Date.now()
    };
};

// Decrypt message using AES
export const decryptMessage = (encryptedData, key) => {
    try {
        const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, key, {
            iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC
        });
        
        const message = decrypted.toString(CryptoJS.enc.Utf8);
        
        // Verify HMAC
        const hmac = CryptoJS.HmacSHA256(message, key).toString();
        if (hmac !== encryptedData.hash) {
            throw new Error('Message integrity check failed');
        }
        
        // Verify timestamp
        const messageAge = Date.now() - encryptedData.timestamp;
        if (messageAge > 5 * 60 * 1000) { // 5 minutes
            throw new Error('Message too old');
        }
        
        return message;
    } catch (error) {
        console.error('Decryption error:', error);
        throw error;
    }
};

// Store keys securely in IndexedDB
export const initSecureStorage = async () => {
    const dbName = 'secureChatDB';
    const dbVersion = 1;
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create stores for keys and messages
            if (!db.objectStoreNames.contains('keys')) {
                db.createObjectStore('keys', { keyPath: 'userId' });
            }
            
            if (!db.objectStoreNames.contains('messages')) {
                const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
                messageStore.createIndex('timestamp', 'timestamp', { unique: false });
                messageStore.createIndex('status', 'status', { unique: false });
            }
        };
    });
};

// Store user's keys
export const storeUserKeys = async (userId, keys) => {
    const db = await initSecureStorage();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['keys'], 'readwrite');
        const store = transaction.objectStore('keys');
        const request = store.put({ userId, keys });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Get user's keys
export const getUserKeys = async (userId) => {
    const db = await initSecureStorage();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['keys'], 'readonly');
        const store = transaction.objectStore('keys');
        const request = store.get(userId);
        
        request.onsuccess = () => resolve(request.result?.keys);
        request.onerror = () => reject(request.error);
    });
};

// Store message locally
export const storeMessage = async (message) => {
    const db = await initSecureStorage();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        const request = store.add({
            id: Date.now().toString(),
            ...message,
            timestamp: Date.now()
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Get offline messages
export const getOfflineMessages = async () => {
    const db = await initSecureStorage();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}; 
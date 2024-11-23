const persistence = require('./persistence')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')

async function newUser(name, email, pass) {
    return await persistence.newUser(name, email, pass)
}

async function findUser(email, password) {
    return await persistence.findUser(email, password)
}

async function startSession(data) {
    const sessionId = uuidv4()
    const expiryDate = new Date(Date.now() + 60 * 1000)
    await persistence.createSession(sessionId, expiryDate, data)
    return sessionId;
}

async function getSession(sessionId) {
    return await persistence.getSession(sessionId)
}

async function refreshSession(sessionId) {
    await persistence.updateSessionExpiry(sessionId)
}


async function generateVerificationToken(email) {
    const token = crypto.randomBytes(16).toString('hex')
    await persistence.createVerificationToken(email, token)
    return token;
}


async function sendVerificationEmail(email, token) {
    const verificationUrl = `http://localhost:8000/verify-email?token=${token}`
    const emailContent = `
    <html>
    <body>
        <p>This verification link will expire in 1 hour. Please make sure to verify your email within that time frame.</p>
        <a href="${verificationUrl}"></a>
    </body>
    </html>
    `
    
    
    console.log(emailContent)
    return true
}

async function verifyEmailToken(token) {
    const tokenData = await persistence.getVerificationToken(token)
    
    if (!tokenData || tokenData.expiryDate < new Date()) {
        return false
    }
    await persistence.markEmailAsVerified(tokenData.email)
    return true
}



module.exports = {
    newUser,
    findUser,
    startSession,
    refreshSession,
    getSession,
    verifyEmailToken,
    generateVerificationToken,
    sendVerificationEmail
}

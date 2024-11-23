const mongodb = require('mongodb')

let client, db, User, Session

async function connectDatabase() {
    client = client || new mongodb.MongoClient('mongodb+srv://amel:yellow123@cluster0.u7evb.mongodb.net/')
    await client.connect()
    db = db || client.db('project')
    User = User || db.collection('User')
    Session = Session || db.collection('Session')

    await Session.createIndex({ expiryDate: 1 }, { expireAfterSeconds: 60 })
}

async function newUser(name, email, pass) {
    await connectDatabase()
    await User.insertOne({ name, email, password: pass, email_status: false })
}

async function findUser(email, password) {
    await connectDatabase()
    return await User.findOne({ email, password })
}


async function createSession(sessionId, userId, sessionData) {


    await connectDatabase()
    const session = {
        sessionId: sessionId,
        userId: userId,
        sessionData: sessionData,
        expiry: new Date(Date.now() + 60 * 60 * 1000),
    }

    await db.collection('Session').insertOne(session)
}



async function updateSessionExpiry(sessionId) {
    await connectDatabase()
    const newExpiryDate = new Date(Date.now() + 60 * 1000)
    await Session.updateOne({ sessionId }, { $set: { expiryDate: newExpiryDate } })
}

async function getSession(sessionId) {
    await connectDatabase()
    return await db.collection('Session').findOne({ sessionId })
}

async function createVerificationToken(email, token) {
    await connectDatabase()
    const expiry = new Date(Date.now() + 60 * 60 * 1000)
    const verificationData = {
        email,
        token,
        expiryDate: expiry
    }
    await db.collection('EmailVerification').insertOne(verificationData)
}

// Retrieve the verification token
async function getVerificationToken(token) {
    await connectDatabase()
    return await db.collection('EmailVerification').findOne({ token })
}

// Mark the user's email as verified
async function markEmailAsVerified(email) {
    await connectDatabase()
    await User.updateOne({ email }, { $set: { email_status: true } })
}

module.exports = { newUser, findUser, createSession, updateSessionExpiry,getSession,createVerificationToken,getVerificationToken,markEmailAsVerified };

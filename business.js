const persistence = require('./persistence')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')

async function newUser(name, email, pass) {
    return await persistence.newUser(name, email, pass)
}

async function findUser(email, password) {
    return await persistence.findUser(email, password)
}

async function updateUserProfile(email, fluentlanguage,learnlanguage ,gender) {
    if (!fluentlanguage || !gender) {
        console.log('Error: All fields are required');
        console.log(gender,fluentlanguage,learnlanguage)
        return; // Stop if any field is missing
    }

    const userDetails = {
        fluentlanguage: fluentlanguage,
        learnlanguage: learnlanguage,
        gender: gender
    };

    const result = await persistence.updateUserDetails({ email: email }, userDetails);

    if (result.matchedCount === 0) {
        console.log('Error: User not found');
        return;
    }

    console.log('User profile updated successfully');
}

async function updateUserPassword(email,newPass){
    const updateFields = {
        password: newPass,
    }

    const filter = {email}
    await persistence.updateUserDetails(filter,updateFields)
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

async function deleteSession(sessionId){
    await persistence.deleteSession(sessionId)
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

async function getPasswordResetToken(token){
    return await persistence.getPasswordResetToken(token)
}


async function verifyEmailToken(token) {
    const tokenData = await persistence.getVerificationToken(token)
    
    if (!tokenData || tokenData.expiryDate < new Date()) {
        return false
    }
    await persistence.markEmailAsVerified(tokenData.email)
    return true
}


// Generate a password reset token and store it with an expiry date
async function generatePasswordResetToken(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1); // Expiry in 1 hour

    // Store the token and expiry date in the database
    await persistence.savePasswordResetToken(email, token, expiryDate);
    return token;
}

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `http://localhost:8000/reset-password?token=${token}`;
    const emailContent = `
    <html>
    <body>
        <p>You requested to reset your password. Click the link below to reset your password:<br>
        ${resetUrl}</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
    </body>
    </html>
    `;

    // Use your email service (e.g., nodemailer) to send the email
    console.log(emailContent); // Remove this after testing
    return true;
}

async function deletePasswordResetToken(token) {
    await persistence.deletePasswordResetToken
}

//learning contacts

async function removeContact(userId, contactId) {
    return await persistence.removeContact(userId, contactId);
}

async function getContacts(userId) {
    return await persistence.getContacts(userId);
}

async function findEligibleContacts(email) {
    return await persistence.findEligibleContacts(email);
}

async function blockContact(userEmail, contactEmail) {
    return await persistence.blockContact(userEmail, contactEmail);
}

async function unblockContact(userEmail, contactEmail) {
    return await persistence.unblockContact(userEmail, contactEmail);
}

async function addContact(userEmail, contactEmail) {
    // Check eligibility (optional)
    const isEligibleContact = await isEligible(userEmail, contactEmail);
    if (!isEligibleContact) return false;

    // Add contact to the persistence layer
    const result = await persistence.addContactToDatabase(userEmail, contactEmail);
    return result;
}

async function isEligible(userEmail, contactEmail) {
    const user = await persistence.getUser(userEmail); // Fetch user data from persistence
    const contact = await persistence.getUser(contactEmail); // Fetch contact data from persistence

    if (!user || !contact) return false; // Ensure both users exist

    const isFluent = user.learnlanguage.some(lang => contact.fluentlanguage.includes(lang));
    const isBlocked = contact.blockedBy?.includes(userEmail);

    return isFluent && !isBlocked;
}

//messaging
async function addMessage(sender, recipient, message){
    awardBadge(sender)
    await persistence.addMessage(sender, recipient, message)
}

async function getMessages(sender, recipient){
    return await persistence.getMessages(sender, recipient)
}

async function totalMessages(user){
    return await persistence.totalMessages(user)
}

async function getInteractions(user){
    return await persistence.getInteractions(user)

}





module.exports = {
    newUser,
    findUser,
    startSession,
    refreshSession,
    getSession,
    verifyEmailToken,
    generateVerificationToken,
    sendVerificationEmail,
    generatePasswordResetToken,
    sendPasswordResetEmail,
    getPasswordResetToken,
    deletePasswordResetToken,
    updateUserProfile,
    deleteSession,
    addContact,
    removeContact,
    getContacts,
    findEligibleContacts,
    blockContact,
    unblockContact,
    addMessage,
    getMessages,
    getInteractions,
    totalMessages,
    updateUserPassword
}

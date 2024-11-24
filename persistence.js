const mongodb = require('mongodb')


let client, db, User, Session,PRtoken,Contacts,messages

async function connectDatabase() {
    client = client || new mongodb.MongoClient('mongodb+srv://amel:yellow123@cluster0.u7evb.mongodb.net/')
    await client.connect()
    db = db || client.db('project')
    User = User || db.collection('User')
    Session = Session || db.collection('Session')
    PRtoken = PRtoken || db.collection('ResetPasswordToken')
    Contacts = Contacts || db.collection('Contacts')
    messages = messages || db.collection("Messages")

    await Session.createIndex({ expiryDate: 1 }, { expireAfterSeconds: 60 })
}

async function newUser(name, email, pass) {
    await connectDatabase()
    await User.insertOne({ name, email, password: pass, email_status: false,contacts:[]})
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

async function deleteSession(key){
    await Session.deleteOne({sessionId: key})
}

async function updateUserDetails(filter, updateFields) {
    await connectDatabase();
    const result = await User.updateOne(filter, { $set: updateFields });
    return result; // Return the result for business layer handling
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

// Save the token and expiry date in the database
async function savePasswordResetToken(email, token, expiryDate) {
    await connectDatabase()
    await PRtoken.insertOne({ email, token, expiryDate });
}

// Get the token data
async function getPasswordResetToken(token) {
    await connectDatabase()
    return await PRtoken.findOne({ token });
}

// Delete the token after it's used or expired
async function deletePasswordResetToken(token) {
    await connectDatabase()
    await PRtoken.deleteOne({ token });
}

//learning contacts

async function CreateContactList(userEmail){
    await connectDatabase()
    await Contacts.insertOne({email: userEmail, contacts: null})
}

async function updateUserContacts(filter, updateFields) {
    await connectDatabase();
    const result = await Contacts.updateOne(filter, { $set: updateFields }, { upsert: true });
    return result; // Return the result for business layer handling
}



async function addContact(userEmail, contactEmail) {
    // Step 1: Ensure the contact list document exists
    const filter = { userEmail };
    const updateFields = { 
        contacts: [] 
    };
    
    await updateUserDetails(filter, { $setOnInsert: updateFields }); 

    const addContactFields = { 
        $addToSet: { contacts: contactEmail }
    };
    const result = await updateUserContacts(filter, addContactFields); 
    
    return result.modifiedCount > 0; 
}


async function getUser(email) {
    await connectDatabase();
    return await User.findOne({ email }); 
}


async function removeContact(userEmail, contactEmail) {
    await connectDatabase();
    const result = await User.updateOne(
        { email: userEmail },
        { $pull: { contacts: contactEmail } } 
    );
    console.log(`Contact removed: ${contactEmail}`);
}


async function getContacts(userEmail) {
    await connectDatabase();
    const user = await User.findOne({ email: userEmail });
    if (!user || !user.contacts) return [];
    return await User.find({ email: { $in: user.contacts } }).toArray(); // Fetches the user details for each contact
}


async function findEligibleContacts(userEmail) {
    await connectDatabase();
    const user = await User.findOne({ email: userEmail });
    if (!user) return [];

    // Ensure user is not blocked and is fluent in the desired language
    return await User.find({
        fluentlanguage: user.learnlanguage,
        email: { $ne: userEmail }, // Excludes the current user
        blockedContacts: { $nin: [userEmail] } // Ensures the user is not in the blockedContacts list
    }).toArray();
}

async function blockContact(userEmail, contactEmail) {
    await connectDatabase();
    const result = await User.updateOne(
        { email: userEmail },
        { $addToSet: { blockedContacts: contactEmail } } // Adds to the blockedContacts array
    );
    console.log(`Blocked contact: ${contactEmail}`);
}

async function unblockContact(userEmail, contactEmail) {
    await connectDatabase();
    const result = await User.updateOne(
        { email: userEmail },
        { $pull: { blockedContacts: contactEmail } } // Removes from the blockedContacts array
    );
    console.log(`Unblocked contact: ${contactEmail}`);
}


//messaging
async function addMessage(sender, recipient, message){
    await connectDatabase()
    await messages.insertOne({
        sender: sender,
        recipient: recipient,
        message: message,
        time: new Date()
    })

}

async function getMessages(sender, recipient){
    await connectDatabase()
    return await messages.find({sender: sender, recipient: recipient}).toArray()
}

async function getInteractions(user){
    await connectDatabase()
    let list = await messages.find({
        $or: [{sender: user}, {recipient: user}]
    }).toArray()

    let interactions = []
    let found = false

    if(list.length < 1){
        return interactions
    }

    
    for(m of list){
        if(interactions.length < 1){
            if(m.sender !== user){
                interactions.push(m.sender)
            }else{
                interactions.push(m.recipient)
            }
        }
        else{
            if(m.sender !== user){
                for(i of interactions){
                    if(m.sender === i){
                        found = true
                    }
                }
                if(!found){
                    interactions.push(m.sender)
                }
            }
            else{
                for(i of interactions){
                    if(m.recipient === i){
                        found = true
                    }
                }
                if(!found){
                    interactions.push(m.recipient)
                }
            }
        }
        found = false
    }
    return interactions
    
}

async function totalMessages(user){
    await connectDatabase()
    let sent = await messages.countDocuments({sender: user})
    let receive = await messages.countDocuments({recipient: user})
    return [sent, receive]
}



module.exports = { newUser, findUser, getUser,
    createSession, updateSessionExpiry,
    getSession,createVerificationToken,
    getVerificationToken,markEmailAsVerified,
    savePasswordResetToken,getPasswordResetToken,
    deletePasswordResetToken,
    updateUserDetails,
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
    totalMessages
 };

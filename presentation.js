const express = require('express')
const handlebars = require('express-handlebars')
const business = require('./business')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(bodyParser.urlencoded({ extended: true }))
app.set('views', __dirname + '/templates')
app.set('view engine', 'handlebars')
app.engine('handlebars', handlebars.engine())


app.use(async (req, res, next) => {
    const sessionId = req.cookies.sessionId
    if (sessionId) {
        await business.refreshSession(sessionId)
    }
    next();
});

app.get('/', (req, res) => {
    res.render('main', { layout: undefined })
});

app.get('/signup', (req, res) => {
    res.render('signup', { layout: undefined })
})

app.post('/signup', async (req, res) => {
    const { fname, email, password } = req.body;

    await business.newUser(fname, email, password);

    const token = await business.generateVerificationToken(email);
    await business.sendVerificationEmail(email, token);

    res.redirect('/');
    console.log("User created successfully. Verification email sent.");
});


app.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    if (token) {
        const isVerified = await business.verifyEmailToken(token);

        if (isVerified) {
            res.send('Email successfully verified!');
        } else {
            res.send('Invalid or expired token.');
        }
    } else {
        res.send('Token is missing.');
    }
});

app.get('/login', (req, res) => {
    res.render('login', { layout: undefined })
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;  // Only email and password are required for login
    const user = await business.findUser(email, password);

    if (user) {
        // Include additional user details in sessionData
        const sessionData = { 
            userId: user._id, 
            name: user.name, 
            email: user.email, 
            fluentlanguage: user.fluentlanguage,
            learnlanguage: user.learnlanguage,
            gender: user.gender, 
        };

        // Start session and get sessionId
        const sessionId = await business.startSession(sessionData);

        // Store sessionId in a cookie
        res.cookie('sessionId', sessionId, { maxAge: 60 * 60 * 1000, httpOnly: true });

        console.log("Login successful");

        if (!user.fluentlanguage|| !user.learnlanguage || !user.gender) {
            // If any of those fields are missing, redirect to the set-up-profile page
            res.redirect('/set-up-profile');
        } else {
            // Otherwise, redirect to the profile page
            res.redirect('/profile');
        }
    } else {
        console.log("Login failed");
        res.render('login', { layout: undefined, error: 'Invalid email or password' });
    }
});



app.get('/profile', async (req, res) => {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
        return res.redirect('/login');
    }

    const session = await business.getSession(sessionId); // Retrieve session data from your business logic

    if (session) {
        res.render('profile', {
            layout: undefined,
            name: session.sessionData.name,
            email: session.sessionData.email,
            fluentlanguage: session.sessionData.fluentlanguage,
            learnlanguage: session.sessionData.learnlanguage,
            gender: session.sessionData.gender
        });
    } else {
        res.redirect('/login'); // If no session, redirect to login
    }
});


app.get('/request-reset-password', (req, res) => {
    res.render('requestResetPassword', {layout: undefined}); // This renders the page with the email input form
});

app.post('/send-reset-link', async (req,res) => {
    const { email } = req.body; // Get the email from the form

    try {
        // Generate the password reset token for the user
        const token = await business.generatePasswordResetToken(email);

        // Send the reset email with the generated token
        const emailSent = await business.sendPasswordResetEmail(email, token);

        if (emailSent) {
            // Success: Notify the user that the email has been sent
            res.send('Password reset link sent to your email.');
        } else {
            // If the email sending failed
            res.send('Failed to send reset email.');
        }
    } catch (error) {
        // Catch and handle any errors that occur during the process
        console.error(error);
        res.send('An error occurred while processing your request.');
    }

})

app.get('/reset-password', async (req, res) => {
    const { token } = req.query; // Get the token from the query string

    if (!token) {
        return res.send('Invalid or missing token');
    }

    // Check if the token exists and is still valid (optional - you can add token expiration validation)
    const tokenData = await business.getPasswordResetToken(token);
    if (!tokenData || new Date() > new Date(tokenData.expiryDate)) {
        return res.send('Invalid or expired token');
    }

    // Render the reset password form, passing the token to the template
    res.render('resetPassword', { layout:undefined,token }); // Pass token as a variable to the template
});

app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body; // Get token and new password from the form
    const tokenData = await business.getPasswordResetToken(token);
    if (!tokenData || new Date() > new Date(tokenData.expiryDate)) {
        return res.status(400).send('Invalid or expired token');
    }

    
    await business.updateUserPassword(tokenData.email, newPassword); 

    await business.deletePasswordResetToken(token); 

    // Send a success response or redirect the user
    res.redirect('/');
});




app.get('/set-up-profile', (req, res) => {
    const languages = [
        'English',
        'Spanish',
        'French',
        'German',
        'Chinese',
        'Japanese',
        'Korean',
    ]; 

    const languages2 = [
        'English',
        'Spanish',
        'French',
        'German',
        'Chinese',
        'Japanese',
        'Korean',
    ]; 


    res.render('SetUpProfile', { languages, languages2, layout:undefined}); // Pass the list to Handlebars
});

app.post('/submit-details', async (req, res) => {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
        return res.redirect('/login');
    }

    const session = await business.getSession(sessionId);
    const { fluentlanguage,learnlanguage ,gender } = req.body;
    
    await business.updateUserProfile(session.sessionData.email,fluentlanguage,learnlanguage,gender)
    session.sessionData.fluentlanguage = fluentlanguage;
    session.sessionData.learnlanguage = learnlanguage;
    session.sessionData.gender = gender;
    
    res.redirect('/profile');
});

//learning contacts
// View contacts
app.get('/profile/contacts', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return res.redirect('/login');

    const session = await business.getSession(sessionId);
    const userEmail = session.sessionData.email; // Get email from session

    const contacts = await business.getContacts(userEmail);
    console.log(contacts); // Log to see what contacts are returned

    res.render('contacts', { layout: undefined, contacts });
});



// Add contact
app.get('/profile/contacts', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return res.redirect('/login');

    const session = await business.getSession(sessionId);
    if (!session) return res.send('Session not found.');

    const userEmail = session.sessionData.email; // Get the logged-in user's email
    const contacts = await business.getContacts(userEmail);

    if (!contacts) return res.send('No contacts found.');

    // Render the contacts page with the list of contacts
    res.render('contacts', { contacts });
});


app.get('/profile/contacts/add-contact', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return res.redirect('/login');
    
    const session = await business.getSession(sessionId);
        if (!session) return res.redirect('/login');

        const userEmail = session.sessionData.email;
        const eligibleContacts = await business.findEligibleContacts(userEmail);

        // Render the add-contact page and pass eligible contacts
        res.render('addContact', { layout: undefined, eligibleContacts });
});



app.post('/profile/contacts/add-contact', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return res.redirect('/login');


    const session = await business.getSession(sessionId);
    const userEmail = session.sessionData.email; // Get email from session
    const { contactEmail } = req.body; // Use email for the contact

    await business.addContact(userEmail, contactEmail);
    session.sessionData.sessionId = 
    res.redirect('/profile/contacts');
});



// Remove contact
app.patch('/profile/contacts/remove-contact', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) return res.redirect('/login');

    const session = await business.getSession(sessionId);
    const userEmail = session.sessionData.email; // Get email from session
    const { contactEmail } = req.body; // Use email for the contact

    await business.removeContact(userEmail, contactEmail); // Use email instead of userId
    res.redirect('/profile/contacts');
});

//message
app.get('/profile/view-messages', async(req, res) =>{
    let sessionId = req.cookies.sessionId
    if(!sessionId){
        res.redirect('/')
        return
    }
    let session = await business.getSession(sessionId)
    if(!session || !sessionId){
        res.redirect('/')
        return
    }

    let email = session.sessionData.email
    let messages = await business.getInteractions(email)
    res.render('view-messages', {layout: undefined, messages})
})

app.get('/profile/messages/:recipient', async (req, res) => {
    let sessionId = req.cookies.sessionId;

    // Mocking logic
    const isMock = req.query.mock === 'true'; // Check if 'mock=true' is passed in the query
    let session;
    if (isMock) {
        // Simulated session data
        session = {
            sessionData: { email: 'rara@gmail.com' }, // Replace with your mock data
        };
    } else {
        if (!sessionId) {
            res.redirect('/');
            return;
        }
        session = await business.getSession(sessionId);
        if (!session) {
            res.redirect('/');
            return;
        }
    }

    const email = session.sessionData.email;
    const recipient = req.params.recipient;
    const alert = req.query.alert;

    // Render with mock or real data
    res.render('messages', { layout: undefined, recipient, sender: email, alert });
});

app.get('/getMessages/:recipient', async (req, res) => {
    const isMock = req.query.mock === 'true'; // Enable mock mode via query parameter
    let session, email, messages, receive;
    
    if (isMock) {
        // Simulate session data
        session = { sessionData: { email: 'asd@gmail.com' } }; // Replace with mock data
        email = session.sessionData.email;

        // Simulate messages sent and received
        messages = [
            { sender: email, recipient: req.params.recipient, text: "Hello!" },
            { sender: email, recipient: req.params.recipient, text: "How are you?" }
        ];
        receive = [
            { sender: req.params.recipient, recipient: username, text: "Hi there!" },
            { sender: req.params.recipient, recipient: username, text: "I'm good, thanks!" }
        ];
    } else {
        let sessionId = req.cookies.sessionId;
        if (!sessionId) {
            res.redirect('/');
            return;
        }
        
        session = await business.getSession(sessionId);
        if (!session) {
            res.redirect('/');
            return;
        }
        
        email = session.sessionData.email;
        const recipient = req.params.recipient;

        // Fetch messages from business layer
        messages = await business.getMessages(email, recipient);
        receive = await business.getMessages(recipient, email);
    }

    // Combine sent and received messages
    for (let r of receive) {
        messages.push(r);
    }

    res.send(messages);
});







app.get("/logout" , async(req,res)=>{
    await business.deleteSession(req.cookies.sessionId)
    res.cookie('sessionId', '',{expires: new Date(Date.now())} )
    res.redirect('/')
})
app.listen(8000, () => console.log("App is running on port 8000"))

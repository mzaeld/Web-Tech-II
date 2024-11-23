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
    const { email, password } = req.body
    const user = await business.findUser(email, password)

    if (user) {
        const sessionData = { userId: user._id, name: user.name }
        const sessionId = await business.startSession(sessionData)

        res.cookie('sessionId', sessionId, { maxAge: 60 * 60 * 1000, httpOnly: true })

        console.log("Login successful")
        res.redirect('/profile')
    } else {
        console.log("Login failed")
        res.render('login', { layout: undefined, error: 'Invalid email or password' })
    }
})


app.get('/profile', async (req, res) => {
    const sessionId = req.cookies.sessionId

    const session = await business.getSession(sessionId)

    if (session) {
        res.render('profile', { layout: undefined, name: session.sessionData.name })
    } else {
        res.redirect('/login')
    }
}); 


app.listen(8000, () => console.log("App is running on port 8000"))

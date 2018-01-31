const express = require('express')
const expressSession = require('express-session')
const cors = require('cors')
const passport = require('passport')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const methodOverride = require('method-override') 
const partials = require('express-partials')

const app = express()
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')

app.use(cors())
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", process.env.CHROME_EXTENSION)
  res.header("Access-Control-Allow-Credentials", "true")
  res.header("Allow-Credentials", "true")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
}); 
app.use(expressSession({ 
  secret: process.env.SESSION_SECRET, 
  resave: true, 
  saveUninitialized: true, 
  maxAge: (90 * 24 * 3600000) 
}))
app.use(passport.initialize())
app.use(passport.session())

app.use(partials())
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(methodOverride())
app.use(express.static('public'))


// Passport allows us to login and save github tokens 😎
const GitHubStrategy = require('passport-github').Strategy

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: 'https://' + process.env.PROJECT_DOMAIN + '.glitch.me/auth/github/callback',
    scope: 'user:email repo',
  },
  function(accessToken, refreshToken, profile, cb) {
    profile.accessToken = accessToken
    profile.refreshToken = refreshToken
    return cb(null, profile)
  }
))

passport.serializeUser(function(user, done) {
  done(null, user)
})

passport.deserializeUser(function(obj, done) {
  done(null, obj)
})

// Octokit is how we talk to GitHub
const octokit = require('@octokit/rest')()

app.get('/', function(req, res){
  res.render('index', { user: req.user })
})

app.get('/login', function(req, res){
  res.render('login', { user: req.user })
})

app.get('/auth/github', passport.authenticate('github'), function(req, res){
  // Redirect to GitHub.com (never called)
})

app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function(req, res) {
  // Success! Redirect to the homepage
  res.redirect('/')
})

app.get('/logout', function(req, res){
  // Kill the session
  req.logout()
  // Go to the home page
  res.redirect('/')
})

app.post('/react', ensureAuthenticated,       
  async function(req, res) {  
    // url
    // reaction
    // actor
    // autor
    // object_id
    // text
    const id = req.query.url || ""
    
    // oauth
    octokit.authenticate({
      type: 'oauth',
      token: req.user.accessToken
    })

    const owner = req.user.username
    const repo = "diary" 
    const title = `Emotions ${req.body.message}`
    const body = `${req.body.message}`
    const labels = []
    let result
    try {
      result = await octokit.issues.create({owner, repo, title, body, labels})
    } catch(err) {
      result = err
    }  
    res.render('user', { user: req.user, repo: result })
  } 
)


// if user exists show it
app.get('/user', ensureAuthenticated, 
  async function(req, res) {  
    // oauth
    octokit.authenticate({
      type: 'oauth',
      token: req.user.accessToken
    })

    const owner = req.user.username
    const repo = "diary"

    let result
    try {
      result = await octokit.repos.create({name: repo, private: true})
    } catch(err) {
      // This may fail because the repo already exists
      result = err
    }

    try {
      result = await octokit.issues.getForRepo({owner, repo})
    } catch(err) {
      result = err
    }
    res.render('user', { user: req.user, repo: result })
  } 
)

// Middleware for protected resources
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port)
})

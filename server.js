
const express = require('express')
const session = require('cookie-session')
const partials = require('express-partials')
const cors = require('cors')
const passport = require('passport')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const app = express()
app.use(express.static('public'));
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

app.use(partials());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser()); 
app.use(session({ 
  secret: process.env.SESSION_SECRET, 
  resave: false, 
  saveUninitialized: true, 
  maxAge: (90 * 24 * 3600000),
  cookie: {
    path: '/',
    _expires: null, 
    originalMaxAge: null,
    httpOnly: true
  }
}));
app.use(passport.initialize());
app.use(passport.session());


// Passport allows us to login and save github tokens 😎
const GitHubStrategy = require('passport-github').Strategy
const octokit = require('@octokit/rest')()


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
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.redirect('/user');
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

// GET /auth/github
//
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHub will redirect the user
//   back to this application at /auth/github/callback
app.get('/auth/github', passport.authenticate('github'), function(req, res){
  // The request will be redirected to GitHub for authentication, so this
  // function will not be called.
});

// GET /auth/github/callback
//
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function(req, res) {
  res.redirect('/');
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}


app.post('/react', ensureAuthenticated,       
  async function(req, res) {  
    // url
    // reaction
    // actor
    // autor
    // object_id
    // text
    console.log(req.body)
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
    res.render('account', { user: req.user, repo: result })
  } 
);


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
      result = await octokit.issues.getForRepo({owner, repo})
    } catch(err) {
      result = err
    }
    res.render('account', { user: req.user, repo: result })
  } 
);

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});

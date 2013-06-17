// codecast

var pkg             = require('./package.json'),
    http            = require('http'),
    fs              = require('fs'),
    path            = require('path');

var express         = require('express'),
    MemoryStore     = express.session.MemoryStore;

var passport        = require('passport'),
    TwitterStrategy = require('passport-twitter').Strategy;

/**
 * Configuration
 * See: http://s.phuu.net/12PFa6J
 */

// Grab the config file if it's there
var configFile;
try {
  configFile = require('./config.json');
} catch (e) {
  configFile = {};
}

// Then configure!
var config = {
  port: parseInt(process.argv[2], 10) ||
        parseInt(process.env.PORT, 10) ||
        3567,
  twitter: {
    id:          configFile.TWITTER_ID ||
                 process.env.TWITTER_ID,
    secret:      configFile.TWITTER_SECRET ||
                 process.env.TWITTER_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK ||
                 'http://localhost:3567/auth/twitter/callback'
  },
  proxy: {
    id: process.env.PROXY_CLIENT_ID
  },
  session: {
    secret: configFile.SESSION_SECRET ||
            process.env.SESSION_SECRET ||
            'keyboard fricking cat'
  }
};

/**
 * Passport express
 */

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


passport.use(new TwitterStrategy({
    consumerKey: config.twitter.id,
    consumerSecret: config.twitter.secret,
    callbackURL: config.twitter.callbackURL
  },
  function(token, tokenSecret, profile, done) {
    return done(null, {
      token: token,
      token_secret: tokenSecret,
      proxy_client_id: config.proxy.id,
      profile: profile
    });
  }
));

/**
 * Configure & setup
 */

// Express

var app = express();
var server = http.createServer(app);

app.set('port', config.port);

app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.engine('html', function (path, options, fn) {
  if ('function' == typeof options) {
    fn = options, options = {};
  }
  fs.readFile(path, 'utf8', fn);
});

app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({
  secret: config.session.secret,
  store: new MemoryStore()
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

app.configure('development', function () {
  app.use(express.errorHandler());
});

app.configure('production', function () {
  app.use(function (req, res, next, err) {
    res.send('There was an error, sorry.');
  });
});

/**
 * Routes
 */

// Authentication
app.get('/auth/twitter',
  passport.authenticate('twitter'));

app.get('/auth/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout',
  function(req, res) {
    req.session.destroy();
    res.redirect('/');
  });

// API
app.get('/api/user',
  function (req, res) {
    res.jsonp(req.user || {});
  });

// Serve the front end
app.get('/*?', function (req, res) {
  console.log(req.user);
  console.log(req.session);
  res.render('index', {
    layout: false
  });
});

/**
 * Gogogo
 */

server
  .listen(app.get('port'), function(){
    console.log("Server listening on port " + app.get('port'));
  });

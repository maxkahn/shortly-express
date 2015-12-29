var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require("express-session");


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

// Auth MiddleWare
app.use(session({secret: "false"}));

var restrict = function(request, res, next){
  console.log(">>>>>>>>>> request.session",request.session)
  if(request.session.user){
    // console.log("Session ID: ", request.sessionID);
    console.log(">>>>>>>>>>IN IF BLOCK Restrict");
    next();
  } else {
    console.log(">>>>>>>>>>IN ELSE BLOCK Restrict");
    //console.log(">>>>>>>> ELSE response", res)
    request.session.error = "No Valid Credentials Provided";
    res.redirect('/login');
    next();
  }
};

app.get('/', restrict, function(req, res) {
  res.render('index');
});

app.get('/create', restrict, function(req, res) {
  res.render('index');

});

app.get('/links', restrict, function(req, res) {
  Links.reset().query('where', 'user_id', '=', req.session.user_id).fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.get("/login", function(req, res){
  console.log("reached GET login");
  res.render("login");
});

app.get("/signup", function(req, res){
  res.render("signup");
});

//Auth Login
app.post("/login", function(req, res){
  console.log("reached POST login");
  var username = req.body.username;
  var password = req.body.password;

  new User({
    username: username,
    password: password
  }).fetch().then(function(found) {
    if (found) {
      console.log(">>>>>>FOUND USER");
      req.session.regenerate(function(){
        req.session.user = username;
        req.session.user_id = found.id;
        //TODO: index as placeholder, we'll send user somewhere else
        console.log("user session id",req.session.user_id)
        res.redirect('/');
      });
      
    }
    else {
      res.redirect('/login');
    }
  });

});

//Auth signup
app.post("/signup", function(req, res){
  console.log("reached POST signup");
  var username = req.body.username;
  var password = req.body.password;

  Users.create({username: username, password: password}).then(function(){
    res.redirect("/login");
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin,
          user_id: parseInt(req.session.user_id)
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

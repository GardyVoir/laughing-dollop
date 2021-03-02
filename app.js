const express = require("express");
const app = express();
const hash = require("pbkdf2-password")();
const path = require("path");
var session = require("express-session");

const { MongoClient } = require("mongodb");

const url = 'mongodb+srv://User:cvGh1hh1QjKcsnfw@securitocluster.sbsua.mongodb.net/CoffreFort?retryWrites=true&w=majority'
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

// config

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// middleware

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
    secret: "shhhh, very secret",
  })
);

// Session-persisted message middleware

app.use(function (req, res, next) {
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = "";
  if (err) res.locals.message = '<p class="msg error">' + err + "</p>";
  if (msg) res.locals.message = '<p class="msg success">' + msg + "</p>";
  next();
});

// dummy database

// var users = {
//   tj: { name: "tj" },
// };

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

// hash({ password: "foobar" }, function (err, pass, salt, hash) {
//   if (err) throw err;
//   // store the salt & hash in the "db"
//   users.tj.salt = salt;
//   users.tj.hash = hash;
// });

// Authenticate using our plain-object database of doom!

async function authenticate(name, pass, fn) {
  if (!module.parent) console.log("authenticating %s:%s", name, pass);
  // var user = users[name];
  // query the db for the given username

  await client.connect();
  const database = client.db('CoffreFort');
  const Users = database.collection('Users');
  var user = await Users.findOne({ utilisateur: name, mdp: pass })
  if (!user) return fn(new Error("cannot find user"));
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user

  // hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
  //   if (err) return fn(err);
  //   if (hash === user.hash) return fn(null, user);
  //   fn(new Error("invalid password"));
  // });
  await client.close();
  return fn(null, user);
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = "Access denied!";
    res.redirect("/login");
  }
}

app.get("/", function (req, res) {
  res.redirect("/login");
});

app.get("/restricted", restrict, function (req, res) {
  res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
});

app.get("/logout", function (req, res) {
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function () {
    res.redirect("/");
  });
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.post("/login", function (req, res) {
  authenticate(req.body.username, req.body.password, function (err, user) {
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function () {
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success =
          "Authenticated as " +
          user.utilisateur +
          ' click to <a href="/logout">logout</a>. ' +
          ' You may now access <a href="/restricted">/restricted</a>.';
        res.redirect("back"); //Rediriger directement sur la page d'upload
      });
    } else {
      req.session.error =
        "Authentication failed, please check your " +
        " username and password.";
      res.redirect("/login");
    }
  });
});

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log("Express started on port 3000");
}

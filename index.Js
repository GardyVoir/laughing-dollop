const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
var fs = require("fs");
const path = require("path");
var session = require("express-session");
var multer = require("multer");
var imgModel = require("./models/models");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const GridFsStorage = require("multer-gridfs-storage");

const { MongoClient } = require("mongodb");
const password = "";
const rounds = 10;

const url =
  "mongodb+srv://User:cvGh1hh1QjKcsnfw@securitocluster.sbsua.mongodb.net/CoffreFort?retryWrites=true&w=majority";
const client = new MongoClient(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//config

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// middleware

app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
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

async function authenticate(name, pass, fn) {
  await client.connect();
  const database = client.db("CoffreFort");
  const Users = database.collection("Users");
  var user = await Users.findOne({ utilisateur: name });
  if (!user) return fn(new Error("Utilisateur introuvable"));
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user

  bcrypt.compare(pass, user.mdp, (err, res) => {
    if (err) {
      return console.error(err);
    }
    console.log(res);
    if (res == true) {
      return fn(null, user);
    }
    if (res == false) {
      return fn(new Error("mot de passe incorrect"));
    }
  });
}

async function signup(email, name, pass, fn) {
  await client.connect();
  const database = client.db("CoffreFort");
  const Users = database.collection("Users");

  //TODO vérifier que l'email soit bien un email (regex/validator)

  var user = await Users.findOne({ email: email });
  if (user) {
    err = "Cette adresse mail existe déjà";
    console.log(err);
    return fn(err);
  }

  var user = await Users.findOne({ utilisateur: name });
  if (user) {
    err = "Ce nom d'utilisateur existe déjà";
    console.log(err);
    return fn(err);
  }

  bcrypt.hash(pass, rounds, (err, hash) => {
    if (err) {
      return console.error(err);
    }
    Users.insertOne({ email: email, utilisateur: name, mdp: hash });
    var user = Users.findOne({ utilisateur: name, mdp: hash });
    return fn(null, user);
  });
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
  res.render("restricted");
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

app.get("/signup", function (req, res) {
  res.render("signup");
});

app.post("/signup", function (req, res) {
  signup(
    req.body.email,
    req.body.username,
    req.body.password,
    function (err, user) {
      if (err) {
        req.session.error = err;
        res.redirect("/signup");
      } else {
        req.session.user = user;
        res.redirect("/restricted");
      }
    }
  );
});

app.post("/upload", function (req, res) {
  res.redirect("restricted")
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
        res.redirect("restricted"); //Rediriger directement sur la page d'upload
      });
    } else {
      req.session.error =
        "Authentication failed, please check your " + " username and password.";
      res.redirect("/login");
    }
  });
});

if (!module.parent) {
  app.listen(3000);
}

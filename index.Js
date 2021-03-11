const express = require("express");
const app = express();
const hash = require("pbkdf2-password")();
const path = require("path");
var session = require("express-session");
var Mails = require('./mails');

const { MongoClient } = require("mongodb");
const Mail = require("nodemailer/lib/mailer");

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

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

// hash({ password: "foobar" }, function (err, pass, salt, hash) {
//   if (err) throw err;
//   // store the salt & hash in the "db"
//   users.tj.salt = salt;
//   users.tj.hash = hash;
// });

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

async function signup(email, name, pass, fn) {
    if (!module.parent) console.log("SignUp %s:%s:%s", email, name, pass);

    await client.connect();
    const database = client.db('CoffreFort');
    const Users = database.collection('Users');

    //TODO vérifier que l'email soit bien un email (regex/validator)

    var user = await Users.findOne({ email: email })
    if (user) {
        err = "Cette adresse mail existe déjà";
        console.log(err)
        return fn(err);
    }

    var user = await Users.findOne({ utilisateur: name })
    if (user) {
        err = "Ce nom d'utilisateur existe déjà";
        console.log(err)
        return fn(err);
    }

    //TODO remplacer la ligne suivante par un hash
    var hashedPass = pass

    await Users.insertOne({ email: email, utilisateur: name, mdp: hashedPass })
    var user = await Users.findOne({ utilisateur: name, mdp: pass })
    Mails.SendWelcomeMail(email, name)
    return fn(null, user);
}

async function reset(req, res) {
    await client.connect();
    const database = client.db('CoffreFort');
    const Users = database.collection('Users');
    Users.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
            return fn("Reset expiré. Demandez un nouveau mail")
        }
        res.render('reset', {
            user: req.user
        });
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
    res.send('Hello ' + req.session.user.utilisateur + ' Wahoo! restricted area, click to <a href="/logout">logout</a>');
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

app.get("/forgot", function (req, res) {
    res.render("forgot");
});

app.post("/forgot", function (req, res) {
    Mails.SendForgottenPasswordMail(req)
    req.session.success = "Un mail a été envoyé a l'adresse mail indiquée."
    res.redirect("/forgot");
});

app.get('/reset/:token', function (req, res) {
    reset(req, res, function (err) {
        if (err) {
            req.session.error = err
            res.redirect("/forgot");
        } else {
            req.session.user = user;
            res.redirect("/login");
        }
    })
});

app.get("/reset", function (req, res) {
    res.redirect("/forgot");
});

app.post('/reset/:token', function (req, res) {
    Mails.SendNewPasswordConfirmationMail(req, res, function (err) {
        if (err) {
            req.session.error = err
            res.redirect("/forgot");
        } else {
            req.session.user = user;
            res.redirect("/login");
        }
    })
});


app.post("/signup", function (req, res) {
    signup(req.body.email, req.body.username, req.body.password, function (err, user) {
        if (err) {
            req.session.error = err
            res.redirect("/signup");
        } else {
            req.session.user = user;
            res.redirect("/restricted");
        }
    })
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
                "Authentication failed, please check your " +
                " username and password.";
            res.redirect("/login");
        }
    });
});

/* istanbul ignore next */
if (!module.parent) {
    app.listen(3000);
}

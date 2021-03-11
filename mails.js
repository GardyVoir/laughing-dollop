var session = require("express-session");
var nodemailer = require('nodemailer');
var async = require('async');
var crypto = require('crypto');
const { MongoClient } = require("mongodb");

const url = 'mongodb+srv://User:cvGh1hh1QjKcsnfw@securitocluster.sbsua.mongodb.net/CoffreFort?retryWrites=true&w=majority'
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

module.exports = {
    SendWelcomeMail: function (emailAddress, name) {
        var smtpTransport = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'securitosafe@gmail.com',
                pass: 'Tjb5v67FS'
            }
        });

        var mailOptions = {
            from: 'Securito@gmail.com',
            to: emailAddress,
            subject: 'Welcome to Securito ' + name,
            html: '<h1>Welcome to Securito</h1><p>The brand new online safe, just for you</p>'
        };

        smtpTransport.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    },

    SendForgottenPasswordMail: function (req) {
        async.waterfall([
            function (done) {
                crypto.randomBytes(20, function (err, buf) {
                    var token = buf.toString('hex');
                    done(err, token);
                });
            },
            async function (token) {
                await client.connect();
                const database = client.db('CoffreFort');
                const Users = database.collection('Users');
                var user = await Users.findOne({ email: req.body.email });
                if (!user) {
                    return;
                }
                else {
                    await Users.findOneAndUpdate({ email: req.body.email }, { $set: { resetPasswordToken: token, resetPasswordExpires: Date.now() + 3600000 } });
                    var smtpTransport = nodemailer.createTransport({
                        service: 'Gmail',
                        auth: {
                            user: 'securitosafe@gmail.com',
                            pass: 'Tjb5v67FS'
                        }
                    });
                    var mailOptions = {
                        to: req.body.email,
                        from: 'securitosafe@gmail.com',
                        subject: 'Securito Password Reset',
                        text: 'Vous recevez ceci parce que vous (ou quelqu\'un d\'autre) avez demandé la réinitialisation du mot de passe de votre compte.\n\n' +
                            'Veuillez cliquer sur le lien suivant ou collez-le dans votre navigateur pour terminer le processus:\n\n' +
                            'http://' + req.hostname + ":" + req.socket.localPort + '/reset/' + token + '\n\n' +
                            'Si vous ne l\'avez pas demandé, veuillez ignorer cet e-mail et votre mot de passe restera inchangé.\n'
                    };
                    smtpTransport.sendMail(mailOptions);
                }
            },
        ]);
    },

    SendNewPasswordConfirmationMail: function (req, res) {
        console.log("token : " + req.params.token);
        async.waterfall([
            async function (done) {
                await client.connect();
                const database = client.db('CoffreFort');
                const Users = database.collection('Users');
                var user = await Users.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } });
                if (!user) {
                    return res.redirect('back');
                } else {
                    await Users.findOneAndUpdate({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, { $set: { password: req.body.password, resetPasswordToken: undefined, resetPasswordExpires: undefined } });
                    var smtpTransport = nodemailer.createTransport({
                        service: 'Gmail',
                        auth: {
                            user: 'securitosafe@gmail.com',
                            pass: 'Tjb5v67FS'
                        }
                    });
                    var mailOptions = {
                        to: user.email,
                        from: 'securitosafe@gmail.com',
                        subject: 'Your password has been changed',
                        text: 'Hello,\n\n' +
                            'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
                    };
                    smtpTransport.sendMail(mailOptions);
                }
            },
        ]);
    },
};


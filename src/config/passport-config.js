const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
//const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const authController = require('../controllers/authController');

passport.use(new GoogleStrategy({
    clientID : process.env.GOOGLE_CLIENT_ID,
    clientSecret : process.env.GOOGLE_CLIENT_SECRET_KEY,
    callbackURL : '/api/auth/google/callback'
}, authController.register1));

passport.use(new GitHubStrategy({
    clientID : process.env.GITHUB_CLIENT_ID,
    clientSecret : process.env.GITHUB_CLIENT_SECRET_KEY,
    callbackURL : '/api/auth/github/callback'
}, authController.register1));

passport.use(new FacebookStrategy({
    clientID : process.env.FACEBOOK_CLIENT_ID,
    clientSecret : process.env.FACEBOOK_CLIENT_SECRET_KEY,
    callbackURL : '/api/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'photos', 'emails']

}, authController.register1));



 

module.exports = passport;
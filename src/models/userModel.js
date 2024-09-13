// User Model (userModel.js)
const mongoose = require('mongoose');
const cryptoJS = require('crypto-js');
require('dotenv').config();
const { Schema } = mongoose;

const innerCircleRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'Pending' },
});

const quizParticipationSchema = new Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  joinedAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: String,
  role: { type: String, enum: ['User', 'Subject Matter Expert'], default: 'User' },
  badges: [{
    type: String,
    enum: ['Novice', 'Explorer', 'Creator', 'Specialist', 'Influencer'],
    default: 'Novice'
}],
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  phoneNumber: String,
  dateOfBirth: Date,
  location: String,
  bio: { bioAbout: String, bioInterests: [String] },
  education: [{ degree: String, fieldOfStudy: String, school: String, graduationYear: String }],
  workExperience: [{ position: String, company: String, startDate: Date, endDate: Date, description: String }],
  certifications: [{ title: String, issuer: String, issueDate: Date }],
  courses: [{ title: String, institution: String, completionDate: Date }],
  totalRating: { type: Number, default: 0 },
  followers: [{ type: String }],
  following: [{ type: String }],
  followersCount: { type: Number, default: 0 },
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  resume: String,
  followingCount: { type: Number, default: 0 },
  loginOtp: String,
  forgotpasswordOTP: String,
  userSettings: { type: mongoose.Schema.Types.ObjectId, ref: 'UserSettings' },
  devicetype: String,
  devicetoken: String,
  isFirstTimeLogin: { type: Boolean, default: true },
  isTestUser: { type: Boolean, default: false },
  isAdminUser: { type: Boolean, default: false },
  savedContent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
  innerCircle: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  innerCircleRequests: [innerCircleRequestSchema],
  lastLoginDate: { type: Date }, // New field to track the last login date
  streakCount: { type: Number, default: 0 }, // New field to track the login streak
  streakLabel: { type: String, default: 'No streak' },
  totalPoints: { type: Number, default: 0 },
  level: { type: String, default: 'Beginner' },
  quizParticipation: [quizParticipationSchema],
  bankDetails: {
    accountNumber: { type: String, required: false },
    ifscCode: { type: String, required: false },
    accountName: { type: String, required: false },
  },
  panNumber: { type: String, required: false },
  aadhaarNumber: { type: String, required: false },
  amazonPayLinked: { type: Boolean, default: false }, // To check if Amazon Pay is linked
  amazonPayUserId: { type: String, required: false }, // Store Amazon Pay's user ID after linking
  amazonPayAccessToken: { type: String, required: false }, // Store the OAuth token
}, { collection: 'Users' });

// Method to encrypt sensitive data before saving to the database
userSchema.methods.encryptField = function (field) {
  return cryptoJS.AES.encrypt(field, process.env.ENCRYPTION_KEY).toString();
};

// Method to decrypt sensitive data when needed
userSchema.methods.decryptField = function (encryptedField) {
  const bytes = cryptoJS.AES.decrypt(encryptedField, process.env.ENCRYPTION_KEY);
  return bytes.toString(cryptoJS.enc.Utf8);
};

const User = mongoose.model('User', userSchema);

module.exports = User;

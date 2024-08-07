const mongoose = require('mongoose');
const { Schema } = mongoose;

const innerCircleRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'Pending' },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: String,
  role: { type: String, enum: ['User', 'Subject Matter Expert'], default: 'User' },
  badges: { type: String, enum: ['Novice', 'Explorer', 'Creator', 'Specialist', 'Influencer'], default: 'Novice' },
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
}, { collection: 'Users' });

const User = mongoose.model('User', userSchema);

module.exports = User;

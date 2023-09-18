
const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['User', 'Subject Matter Expert'],
    default: 'User',
  },
  badges: {
    type: String,
    enum: ['Novice', 'Explorer', 'Creator', 'Specialist', 'Influencer'],
    default: 'Novice', // Default badge is 'Novice'
  },
  firstname: {
    type: String,
    required: true,
  },
  lastname: {
    type: String,
    required: true,
  },
  phoneNumber: String,
  dateOfBirth: Date,
  location: String,
  profilePicture: String, // Store the file path or URL to the profile picture
  bio: {
    bioAbout: String,
    bioInterests: [String],
  },
  education: [
    {
      degree: String,
      fieldOfStudy: String, // Add fieldOfStudy here
      school: String,
      graduationYear: String,
    },
  ],
  workExperience: [
    {
      position: String,
      company: String,
      startDate: Date,
      endDate: Date,
      description: String,
    },
  ],
  certifications: [
    {
      title: String,
      issuer: String,
      issueDate: Date,
    },
  ],
  courses: [
    {
      title: String,
      institution: String,
      completionDate: Date,
    },
  ],

  totalRating: {
    type: Number,
    default: 0,
  },

  followers: [
    {
        type: String, 
    },
],

following: [
    {
        type: String, 
    },
],

followersCount: {
  type: Number,
  default: 0, // Default count is 0
},

followingCount: {
  type: Number,
  default: 0, // Default count is 0
},

},


{
  collection: 'Users' // Specify the collection name here
}
);

// Create the User model
const User = mongoose.model('User', userSchema);

// Export the User model
module.exports = User;


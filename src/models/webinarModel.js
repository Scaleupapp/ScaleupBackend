const mongoose = require('mongoose');
const { Schema } = mongoose;

const commentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

const webinarSchema = new Schema({
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  topics: [{ type: String }],
  scheduledTime: { type: Date, required: true },
  maxAttendees: { type: Number, default: 100 },
  attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  waitingRoom: [{ type: Schema.Types.ObjectId, ref: 'User' }], // NEW FIELD for users in the waiting room
  comments: [commentSchema], // Field to store comments
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Field to store likes
  thumbnailUrl: { type: String },  // Store URL to S3 thumbnail
  isCommentEnabled: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },  // Active until the webinar ends
  status: { type: String, enum: ['Upcoming', 'Live', 'Ended'], default: 'Upcoming' },
  isCancelled: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 }, // Track total likes
  commentCount: { type: Number, default: 0 }, // Track total comments
  cancellationCount: { type: Number, default: 0 },
  lastCancellationDate: { type: Date },
  cancellationReason: { type: String }
}, { timestamps: true });

const Webinar = mongoose.model('Webinar', webinarSchema);
module.exports = Webinar;

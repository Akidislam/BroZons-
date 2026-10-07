import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Review must be associated with a product'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating score is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    comment: {
      type: String,
      required: [true, 'Review comment is required'],
      trim: true,
      minlength: [5, 'Review comment must be at least 5 characters'],
      maxlength: [1000, 'Review comment cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid review status',
      },
      default: 'approved',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate reviews from the same user on a single product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Compound index for querying approved reviews of a product chronologically
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

// Static method to recalculate product average rating
reviewSchema.statics.calculateAverageRating = async function (productId) {
  const stats = await this.aggregate([
    {
      $match: { product: productId, status: 'approved' },
    },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  try {
    if (stats.length > 0) {
      await mongoose.model('Product').findByIdAndUpdate(productId, {
        'rating.average': Math.round(stats[0].averageRating * 10) / 10,
        'rating.count': stats[0].numReviews,
      });
    } else {
      await mongoose.model('Product').findByIdAndUpdate(productId, {
        'rating.average': 0,
        'rating.count': 0,
      });
    }
  } catch (error) {
    console.error(`[Review Rating Sync Error] ${error.message}`);
  }
};

// Automatic post-save hook to recompute product rating stats
reviewSchema.post('save', async function () {
  if (this.constructor && typeof this.constructor.calculateAverageRating === 'function') {
    await this.constructor.calculateAverageRating(this.product);
  }
});

// Automatic post-delete hook for findOneAndDelete
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc && doc.constructor && typeof doc.constructor.calculateAverageRating === 'function') {
    await doc.constructor.calculateAverageRating(doc.product);
  }
});

// Automatic post-delete hook for document-level deleteOne
reviewSchema.post('deleteOne', { document: true, query: false }, async function () {
  if (this.constructor && typeof this.constructor.calculateAverageRating === 'function') {
    await this.constructor.calculateAverageRating(this.product);
  }
});

const Review = mongoose.model('Review', reviewSchema);

export default Review;

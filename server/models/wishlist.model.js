import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Total number of wishlisted items
wishlistSchema.virtual('totalItems').get(function () {
  return this.products ? this.products.length : 0;
});

// Index for querying wishlists containing a specific product
wishlistSchema.index({ products: 1 });

// Pre-validation hook to deduplicate products array
wishlistSchema.pre('validate', function () {
  if (this.products && this.products.length > 0) {
    const uniqueIds = Array.from(new Set(this.products.map((id) => id.toString())));
    this.products = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  }
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;

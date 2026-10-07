import mongoose from 'mongoose';

const productImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    alt: {
      type: String,
      trim: true,
      default: '',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Product name must be at least 3 characters'],
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be greater than or equal to 0'],
    },
    discountPrice: {
      type: Number,
      default: 0,
      min: [0, 'Discount price must be greater than or equal to 0'],
      validate: {
        validator: function (value) {
          if (value == null || value === 0) return true;
          if (this && typeof this.price === 'number') {
            return value <= this.price;
          }
          return true;
        },
        message: 'Discount price ({VALUE}) cannot be higher than regular price',
      },
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    images: {
      type: [productImageSchema],
      set: function (items) {
        if (!Array.isArray(items)) return items;
        return items.map((item, index) => {
          if (typeof item === 'string') {
            return {
              url: item.trim(),
              alt: '',
              isPrimary: index === 0,
            };
          }
          return item;
        });
      },
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'A product must have at least one image',
      },
    },
    stock: {
      type: Number,
      required: [true, 'Stock count is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    sku: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      sparse: true, // Allows null/missing during drafts without collision
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'out_of_stock', 'archived'],
        message: '{VALUE} is not a valid product status',
      },
      default: 'active',
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: [0, 'Rating average cannot be less than 0'],
        max: [5, 'Rating average cannot be greater than 5'],
      },
      count: {
        type: Number,
        default: 0,
        min: [0, 'Rating count cannot be negative'],
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Effective selling price considering discount
productSchema.virtual('finalPrice').get(function () {
  return this.discountPrice > 0 && this.discountPrice < this.price
    ? this.discountPrice
    : this.price;
});

// Virtual: Num reviews alias
productSchema.virtual('numReviews').get(function () {
  return this.rating ? this.rating.count : 0;
});

// Virtual: Ratings structure alias
productSchema.virtual('ratings').get(function () {
  return this.rating;
});

// Virtual populate: Associated reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
});

// Auto-generate slug and normalize string images
productSchema.pre('validate', function () {
  // Normalize string image array if raw URLs were provided
  if (Array.isArray(this.images)) {
    this.images = this.images.map((img, idx) => {
      if (typeof img === 'string') {
        return { url: img, alt: '', isPrimary: idx === 0 };
      }
      return img;
    });
  }

  // Generate slug if missing or name changed
  if (this.name && (!this.slug || (this.isModified('name') && !this.isModified('slug')))) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
});

// Compound index for category listings with status filters
productSchema.index({ category: 1, status: 1 });

// Compound index for featured products listing
productSchema.index({ isFeatured: 1, status: 1 });

// Index for price-based queries and sorting
productSchema.index({ price: 1 });

// Index for chronological / recency queries
productSchema.index({ createdAt: -1 });

// Text index for search functionality
productSchema.index({ name: 'text', description: 'text', brand: 'text' });

const Product = mongoose.model('Product', productSchema);

export default Product;

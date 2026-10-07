import mongoose from 'mongoose';

const categoryImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      default: '',
      trim: true,
    },
    alt: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters'],
      maxlength: [60, 'Category name cannot exceed 60 characters'],
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
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    image: {
      type: categoryImageSchema,
      set: function (val) {
        if (typeof val === 'string') {
          return { url: val.trim(), alt: '' };
        }
        return val;
      },
      default: () => ({ url: '', alt: '' }),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Populate products associated with this category
categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
});

// Virtual: Status string alias for convenience
categorySchema.virtual('status').get(function () {
  return this.isActive ? 'active' : 'inactive';
});

// Auto-generate slug from name and normalize image if passed as a string
categorySchema.pre('validate', function () {
  // Normalize string image to { url, alt } object format if provided as a raw URL string
  if (typeof this.image === 'string') {
    this.image = { url: this.image, alt: '' };
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

const Category = mongoose.model('Category', categorySchema);

export default Category;

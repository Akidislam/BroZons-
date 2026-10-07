import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    price: {
      type: Number,
      required: [true, 'Price snapshot is required'],
      min: [0, 'Price snapshot cannot be negative'],
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    items: [cartItemSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Calculate total cart value
cartSchema.virtual('totalAmount').get(function () {
  if (!this.items || this.items.length === 0) return 0;
  return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
});

// Virtual: Calculate total item count in cart
cartSchema.virtual('totalItems').get(function () {
  if (!this.items || this.items.length === 0) return 0;
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Pre-validation hook: Merge duplicate product entries if present in items array
cartSchema.pre('validate', function () {
  if (this.items && this.items.length > 1) {
    const mergedMap = new Map();
    for (const item of this.items) {
      if (!item.product) continue;
      const prodId = item.product.toString();
      if (mergedMap.has(prodId)) {
        const existing = mergedMap.get(prodId);
        existing.quantity += item.quantity;
        existing.price = item.price; // Update with latest price snapshot
      } else {
        mergedMap.set(prodId, item);
      }
    }
    this.items = Array.from(mergedMap.values());
  }
});

// Index for querying carts containing a specific product
cartSchema.index({ 'items.product': 1 });

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;

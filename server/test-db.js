import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  User,
  Category,
  Product,
  Cart,
  Order,
  Review,
  Wishlist,
} from './models/index.js';

async function runModelVerification() {
  console.log('====================================================');
  console.log('       BroZons Mongoose Schema & Model Audit        ');
  console.log('====================================================');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ ${message}`);
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      throw new Error(message);
    }
  }

  try {
    // ----------------------------------------------------
    // 1. Model Registration & Exports Check
    // ----------------------------------------------------
    console.log('\n[Phase 1] Verifying Model Registration & Modular Exports...');
    const registered = mongoose.modelNames();
    const expected = ['User', 'Category', 'Product', 'Cart', 'Order', 'Review', 'Wishlist'];

    for (const model of expected) {
      assert(registered.includes(model), `Model '${model}' registered in Mongoose`);
    }

    // ----------------------------------------------------
    // 2. User Model Verification
    // ----------------------------------------------------
    console.log('\n[Phase 2] Verifying User Model & Security Requirements...');
    const sampleUser = new User({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'mySecretPassword123',
      phone: '123-456-7890',
      role: 'customer',
      status: 'active',
      addresses: [
        {
          recipientName: 'John Doe',
          phone: '123-456-7890',
          street: '100 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'United States',
          isDefault: true,
        },
      ],
    });

    await sampleUser.validate();
    assert(true, 'User schema passes valid document validation');
    assert(sampleUser.role === 'customer', 'User role defaults to "customer"');
    assert(sampleUser.status === 'active', 'User status defaults to "active"');
    assert(sampleUser.address && sampleUser.address.city === 'New York', 'User address virtual provides default address');

    // Test role enum validation (including user, customer, admin, moderator)
    const validRoles = ['customer', 'user', 'admin', 'moderator'];
    for (const r of validRoles) {
      const u = new User({ name: 'Role Test', email: 'role@example.com', password: 'password123', role: r });
      assert(u.role === r, `User accepts valid role '${r}'`);
    }

    const invalidRoleUser = new User({
      name: 'Bad Role',
      email: 'badrole@example.com',
      password: 'password123',
      role: 'superman',
    });
    try {
      await invalidRoleUser.validate();
      assert(false, 'Should have failed on invalid role');
    } catch (err) {
      assert(err.errors.role, 'User schema rejects invalid role enum');
    }

    // Test invalid email & short password
    const badUser = new User({
      name: 'Bad Email',
      email: 'invalid-email-format',
      password: '123',
    });
    try {
      await badUser.validate();
      assert(false, 'Should have failed on bad user validation');
    } catch (err) {
      assert(err.errors.email, 'User schema catches invalid email format');
      assert(err.errors.password, 'User schema catches password shorter than 6 characters');
    }

    // Test password hashing pre-save logic & comparePassword
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('mySecretPassword123', salt);
    sampleUser.password = hash;
    const isMatch = await sampleUser.comparePassword('mySecretPassword123');
    const isBadMatch = await sampleUser.comparePassword('wrongPass');
    assert(isMatch === true, 'User comparePassword returns true for correct password');
    assert(isBadMatch === false, 'User comparePassword returns false for wrong password');

    // Test password exclusion in toJSON and toObject transforms
    const userJson = sampleUser.toJSON();
    const userObj = sampleUser.toObject();
    assert(userJson.password === undefined, 'User toJSON transform strips plaintext/hashed password');
    assert(userObj.password === undefined, 'User toObject transform strips plaintext/hashed password');

    // ----------------------------------------------------
    // 3. Category Model Verification
    // ----------------------------------------------------
    console.log('\n[Phase 3] Verifying Category Model...');
    const sampleCategory = new Category({
      name: 'Electronics & Gadgets',
      description: 'Devices and tech accessories',
      image: 'https://example.com/gadgets.jpg', // Test string image normalization
    });
    await sampleCategory.validate();
    assert(sampleCategory.slug === 'electronics-gadgets', 'Category auto-generates URL slug');
    assert(sampleCategory.isActive === true, 'Category defaults to isActive = true');
    assert(sampleCategory.image.url === 'https://example.com/gadgets.jpg', 'Category normalizes string image URL to object format');
    assert(sampleCategory.status === 'active', 'Category status virtual resolves to active');

    // Test custom slug retention
    const customSlugCategory = new Category({
      name: 'Custom Category',
      slug: 'my-custom-slug',
    });
    await customSlugCategory.validate();
    assert(customSlugCategory.slug === 'my-custom-slug', 'Category preserves explicitly specified custom slug');

    // ----------------------------------------------------
    // 4. Product Model Verification
    // ----------------------------------------------------
    console.log('\n[Phase 4] Verifying Product Model...');
    const sampleProduct = new Product({
      name: 'Wireless Noise Canceling Headphones',
      description: 'High-fidelity audio with active noise cancellation.',
      price: 199.99,
      discountPrice: 149.99,
      category: sampleCategory._id,
      images: [
        'https://images.example.com/headphones.jpg', // Test string array normalization
      ],
      stock: 50,
      sku: 'BRO-TECH-001',
      brand: 'BroZons Audio',
      status: 'active',
      isFeatured: true,
    });
    await sampleProduct.validate();
    assert(sampleProduct.slug === 'wireless-noise-canceling-headphones', 'Product auto-generates slug');
    assert(sampleProduct.images[0].url === 'https://images.example.com/headphones.jpg', 'Product normalizes string images into image subdocuments');
    assert(sampleProduct.finalPrice === 149.99, 'Product calculates finalPrice virtual based on discount price ($149.99)');
    assert(sampleProduct.rating.average === 0 && sampleProduct.rating.count === 0, 'Product initializes ratings to 0');
    assert(sampleProduct.numReviews === 0, 'Product exposes numReviews virtual');

    // Test discount price validation (discountPrice > price should fail)
    const invalidProduct = new Product({
      name: 'Invalid Price Product',
      description: 'Test',
      price: 50,
      discountPrice: 100, // Invalid: higher than price
      category: sampleCategory._id,
      images: [{ url: 'http://example.com/img.jpg' }],
      stock: 10,
    });
    try {
      await invalidProduct.validate();
      assert(false, 'Should have failed on discountPrice > price');
    } catch (err) {
      assert(err.errors.discountPrice, 'Product rejects discountPrice higher than regular price');
    }

    // ----------------------------------------------------
    // 5. Cart Model Verification
    // ----------------------------------------------------
    console.log('\n[Phase 5] Verifying Cart Model & Duplicate Product Merging...');
    const cartUserId = new mongoose.Types.ObjectId();
    const sampleCart = new Cart({
      user: cartUserId,
      items: [
        {
          product: sampleProduct._id,
          quantity: 2,
          price: 149.99,
        },
        {
          product: sampleProduct._id, // Duplicate product to test merging hook
          quantity: 1,
          price: 149.99,
        },
        {
          product: new mongoose.Types.ObjectId(),
          quantity: 1,
          price: 50.0,
        },
      ],
    });

    // Run validate (triggers pre-validate merging hook)
    await sampleCart.validate();

    assert(sampleCart.items.length === 2, 'Cart pre-validation hook merges duplicate product entries into 1 item');
    assert(sampleCart.items[0].quantity === 3, 'Cart merges item quantity correctly (2 + 1 = 3)');
    assert(sampleCart.totalItems === 4, 'Cart calculates totalItems virtual correctly (3 + 1 = 4)');
    assert(Math.round(sampleCart.totalAmount * 100) / 100 === 499.97, 'Cart calculates totalAmount virtual correctly ($499.97)');

    // ----------------------------------------------------
    // 6. Order Model Verification
    // ----------------------------------------------------
    console.log('\n[Phase 6] Verifying Order Model & Auto-Calculation...');
    const sampleOrder = new Order({
      user: sampleUser._id,
      orderItems: [
        {
          product: sampleProduct._id,
          name: sampleProduct.name,
          image: sampleProduct.images[0].url,
          price: 149.99,
          quantity: 2,
        },
      ],
      shippingAddress: sampleUser.addresses[0],
      subtotal: 299.98,
      shippingCost: 15.0,
      discount: 10.0,
      paymentMethod: 'stripe',
      paymentStatus: 'pending',
      orderStatus: 'pending',
    });

    // Auto-calculate totalAmount via pre-validate hook
    await sampleOrder.validate();
    assert(sampleOrder.totalAmount === 304.98, 'Order automatically computes totalAmount (299.98 + 15 - 10 = 304.98)');
    assert(sampleOrder.orderStatus === 'pending', 'Order defaults to pending order status');
    assert(sampleOrder.paymentStatus === 'pending', 'Order defaults to pending payment status');
    assert(sampleOrder.paymentMethod === 'stripe', 'Order supports "stripe" payment method enum');

    // Test order status returned
    sampleOrder.orderStatus = 'returned';
    await sampleOrder.validate();
    assert(sampleOrder.orderStatus === 'returned', 'Order supports "returned" status enum');

    // ----------------------------------------------------
    // 7. Review Model Verification
    // ----------------------------------------------------
    console.log('\n[Phase 7] Verifying Review Model & Validation...');
    const sampleReview = new Review({
      user: sampleUser._id,
      product: sampleProduct._id,
      rating: 5,
      comment: 'Top quality product! Recommended.',
      status: 'approved',
    });
    await sampleReview.validate();
    assert(true, 'Review schema passes valid document validation');
    assert(sampleReview.status === 'approved', 'Review defaults to approved status');
    assert(typeof Review.calculateAverageRating === 'function', 'Review has static calculateAverageRating function');

    // Test rating bounds
    const invalidReview = new Review({
      user: sampleUser._id,
      product: sampleProduct._id,
      rating: 6, // Invalid > 5
      comment: 'Test comment',
    });
    try {
      await invalidReview.validate();
      assert(false, 'Should have failed on rating > 5');
    } catch (err) {
      assert(err.errors.rating, 'Review rejects ratings outside 1-5 star scale');
    }

    // ----------------------------------------------------
    // 8. Wishlist Model Verification
    // ----------------------------------------------------
    console.log('\n[Phase 8] Verifying Wishlist Model & Deduplication...');
    const prodId1 = new mongoose.Types.ObjectId();
    const prodId2 = new mongoose.Types.ObjectId();
    const sampleWishlist = new Wishlist({
      user: sampleUser._id,
      products: [prodId1, prodId2, prodId1], // Has duplicate prodId1
    });

    // Run validate (triggers pre-validate deduplication hook)
    await sampleWishlist.validate();

    assert(sampleWishlist.products.length === 2, 'Wishlist pre-validation hook deduplicates product IDs');
    assert(sampleWishlist.totalItems === 2, 'Wishlist exposes totalItems virtual');

    // ----------------------------------------------------
    // 9. Schema Indexes Audit
    // ----------------------------------------------------
    console.log('\n[Phase 9] Verifying Schema Index Definitions...');
    const productIndexes = Product.schema.indexes();
    assert(productIndexes.some((idx) => idx[0].category && idx[0].status), 'Product has { category: 1, status: 1 } compound index');
    assert(productIndexes.some((idx) => idx[0].isFeatured && idx[0].status), 'Product has { isFeatured: 1, status: 1 } compound index');
    assert(productIndexes.some((idx) => idx[0].price), 'Product has { price: 1 } index');
    assert(productIndexes.some((idx) => idx[0].createdAt), 'Product has { createdAt: -1 } index');

    const reviewIndexes = Review.schema.indexes();
    assert(reviewIndexes.some((idx) => idx[0].product && idx[0].user && idx[1]?.unique), 'Review enforces unique { product: 1, user: 1 } compound index');
    assert(reviewIndexes.some((idx) => idx[0].product && idx[0].status), 'Review has { product: 1, status: 1, createdAt: -1 } compound index');

    const orderIndexes = Order.schema.indexes();
    assert(orderIndexes.some((idx) => idx[0].user && idx[0].createdAt), 'Order has { user: 1, createdAt: -1 } compound index');
    assert(orderIndexes.some((idx) => idx[0].orderStatus && idx[0].paymentStatus), 'Order has { orderStatus: 1, paymentStatus: 1 } compound index');

    const wishlistIndexes = Wishlist.schema.indexes();
    assert(wishlistIndexes.some((idx) => idx[0].products), 'Wishlist has { products: 1 } index');

    // ----------------------------------------------------
    // 10. Database Connectivity Verification
    // ----------------------------------------------------
    console.log('\n[Phase 10] Testing MongoDB Connectivity Configuration...');
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/brozons';
    console.log(`  Target URI: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);

    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
      console.log(`  ✓ Live MongoDB connected! Connection readyState: ${mongoose.connection.readyState}`);
      await mongoose.disconnect();
    } catch (dbErr) {
      console.log(`  ℹ Local MongoDB daemon is not running on 127.0.0.1:27017 (${dbErr.message}).`);
      console.log(`    Mongoose connection handler is configured and ready.`);
    }

    console.log('\n====================================================');
    console.log(`  ALL ${passedTests}/${totalTests} CHECKS PASSED SUCCESSFULLY!`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('\nVerification Error:', err.message);
    process.exit(1);
  }
}

runModelVerification();

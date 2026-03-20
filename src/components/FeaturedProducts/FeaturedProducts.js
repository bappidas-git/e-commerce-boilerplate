import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useCart } from "../../hooks/useCart";
import { useWishlist } from "../../context/WishlistContext";
import { formatCurrency, getProductMinPrice, truncateText } from "../../utils/helpers";
import styles from "./FeaturedProducts.module.css";

const ProductCard = ({ product, onAddToCart, onToggleWishlist, isWishlisted, onClick }) => {
  const { sellingPrice, originalPrice, discount } = getProductMinPrice(product);

  return (
    <motion.div
      className={styles.card}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    >
      <div className={styles.imageWrapper}>
        <img src={product.images?.[0] || `https://placehold.co/300x300/e2e8f0/475569?text=${encodeURIComponent(product.name)}`} alt={product.name} />
        {discount > 0 && <span className={styles.discountBadge}>{discount}% OFF</span>}
        <button
          className={`${styles.wishlistBtn} ${isWishlisted ? styles.wishlisted : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(product); }}
          aria-label="Toggle wishlist"
        >
          {isWishlisted ? "\u2665" : "\u2661"}
        </button>
      </div>
      <div className={styles.info}>
        <p className={styles.brand}>{product.brand}</p>
        <h3 className={styles.name}>{truncateText(product.name, 45)}</h3>
        <div className={styles.rating}>
          <span className={styles.stars}>{"★".repeat(Math.floor(product.rating || 0))}{"☆".repeat(5 - Math.floor(product.rating || 0))}</span>
          <span className={styles.reviewCount}>({product.totalReviews || 0})</span>
        </div>
        <div className={styles.price}>
          <span className={styles.salePrice}>{formatCurrency(sellingPrice)}</span>
          {discount > 0 && <span className={styles.originalPrice}>{formatCurrency(originalPrice)}</span>}
        </div>
        <button
          className={styles.addToCartBtn}
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart({
              id: `${product.id}-${product.variants?.[0]?.id || "default"}`,
              productId: product.id,
              name: product.name,
              image: product.images?.[0] || "",
              price: sellingPrice,
              comparePrice: originalPrice,
              variantId: product.variants?.[0]?.id || null,
              variantName: product.variants?.[0]?.name || null,
            });
          }}
        >
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
};

const FeaturedProducts = ({ products = [], title = "Featured Products", viewAllLink = "/products" }) => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  if (products.length === 0) return null;

  return (
    <section className={`${styles.section} ${isDarkMode ? styles.dark : ""}`}>
      <div className={styles.sectionHeader}>
        <h2>{title}</h2>
        <button className={styles.viewAllBtn} onClick={() => navigate(viewAllLink)}>View All &rarr;</button>
      </div>
      <div className={styles.grid}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={addToCart}
            onToggleWishlist={toggleWishlist}
            isWishlisted={isInWishlist(product.id)}
            onClick={() => navigate(`/products/${product.id}`)}
          />
        ))}
      </div>
    </section>
  );
};

export default FeaturedProducts;

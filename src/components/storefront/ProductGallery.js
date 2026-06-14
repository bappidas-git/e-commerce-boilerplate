import React, { useState, useEffect, useCallback } from "react";
import { PLACEHOLDER_IMG, onImageError } from "../../utils/helpers";
import { STOREFRONT_CONFIG } from "../../theme/tokens";
import styles from "./ProductGallery.module.css";

// =============================================================================
// ProductGallery — trustworthy product media
// =============================================================================
// Multiple angles via a thumbnail strip (beside the image on desktop, below on
// mobile), desktop hover-zoom, lazy-loaded + alt-texted images, and graceful
// handling when a product has only one image (the strip hides). Thumbnails are
// real buttons with arrow-key navigation for keyboard users.
//
// Props:
//   images    string[]  image URLs (falls back to a placeholder)
//   alt       string    base alt text (the product name)
//   discount  number    optional honest discount % → corner badge
//   zoom      boolean   enable hover-zoom (default from STOREFRONT_CONFIG)
// =============================================================================
const ProductGallery = ({
  images = [],
  alt = "Product image",
  discount = 0,
  zoom = STOREFRONT_CONFIG.gallery.zoom,
}) => {
  const pics = images && images.length > 0 ? images : [PLACEHOLDER_IMG];
  const [index, setIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });

  // Reset to the first image whenever the image set changes (e.g. new product).
  useEffect(() => {
    setIndex(0);
  }, [images]);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const step = useCallback(
    (delta) => setIndex((i) => (i + delta + pics.length) % pics.length),
    [pics.length]
  );

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
  };

  const multi = pics.length > 1;

  return (
    <div className={styles.gallery}>
      {multi && (
        <div className={styles.thumbs} role="tablist" aria-label="Product images">
          {pics.map((img, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={index === i}
              aria-label={`Show image ${i + 1} of ${pics.length}`}
              className={`${styles.thumb} ${index === i ? styles.thumbActive : ""}`}
              onClick={() => setIndex(i)}
              onMouseEnter={() => setIndex(i)}
            >
              <img src={img} alt="" loading="lazy" onError={onImageError} />
            </button>
          ))}
        </div>
      )}

      <div
        className={styles.main}
        onMouseEnter={() => zoom && setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={zoom ? handleMove : undefined}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`${alt} — image ${index + 1} of ${pics.length}`}
      >
        {discount > 0 && <span className={styles.discountBadge}>-{discount}%</span>}
        <img
          src={pics[index] || PLACEHOLDER_IMG}
          alt={`${alt}${multi ? ` — view ${index + 1}` : ""}`}
          className={styles.mainImg}
          onError={onImageError}
          style={
            isZooming
              ? { transform: "scale(2)", transformOrigin: `${pos.x}% ${pos.y}%` }
              : undefined
          }
        />
        {multi && (
          <div className={styles.dots} aria-hidden="true">
            {pics.map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${index === i ? styles.dotActive : ""}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductGallery;

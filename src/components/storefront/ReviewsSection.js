import React from "react";
import StarRating from "./StarRating";
import { formatDate, onImageError } from "../../utils/helpers";
import styles from "./ReviewsSection.module.css";

// =============================================================================
// ReviewsSection — authentic customer reviews + UGC
// =============================================================================
// Renders ONLY the real, approved reviews it is handed (the API already filters
// to status="approved"). It shows verified-purchase badges, review snippets and
// customer photos (UGC) when present — and HONEST empty / error / loading states
// otherwise. The summary average + count are passed in by the parent (a blend of
// the store's recorded aggregate and approved reviews), never invented here.
//
// Props:
//   reviews            array   approved reviews (real)
//   displayAvg         number  aggregate rating to show (real)
//   totalRatingsCount  number  number of ratings behind the average (real)
//   loading, error     boolean
//   onRetry            fn
// =============================================================================
const RatingBar = ({ star, count, total }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{star} ★</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.barCount}>{count}</span>
    </div>
  );
};

const ReviewsSection = ({
  reviews = [],
  displayAvg = 0,
  totalRatingsCount = 0,
  loading = false,
  error = false,
  onRetry,
}) => {
  const list = Array.isArray(reviews) ? reviews : [];
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: list.filter((r) => Math.round(Number(r.rating)) === star).length,
  }));

  return (
    <div className={styles.section}>
      {/* Summary */}
      <div className={styles.summary}>
        <div className={styles.avgBlock}>
          {totalRatingsCount > 0 ? (
            <>
              <span className={styles.avgNumber}>{displayAvg.toFixed(1)}</span>
              <StarRating rating={displayAvg} size={22} />
              <span className={styles.avgTotal}>
                Based on {totalRatingsCount.toLocaleString()} rating
                {totalRatingsCount !== 1 ? "s" : ""}
              </span>
            </>
          ) : (
            <span className={styles.avgEmpty}>No ratings yet</span>
          )}
        </div>
        <div className={styles.bars}>
          {list.length > 0 ? (
            <>
              {breakdown.map(({ star, count }) => (
                <RatingBar key={star} star={star} count={count} total={list.length} />
              ))}
              <span className={styles.barsCaption}>
                Distribution of {list.length} written review
                {list.length !== 1 ? "s" : ""}
              </span>
            </>
          ) : error ? null : (
            <span className={styles.barsEmpty}>No written reviews yet.</span>
          )}
        </div>
      </div>

      {/* List / states */}
      {loading ? (
        <div className={styles.state}>Loading reviews…</div>
      ) : error ? (
        <div className={styles.state}>
          <p>Sorry, we couldn&rsquo;t load reviews right now.</p>
          {onRetry && (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      ) : list.length === 0 ? (
        <div className={styles.state}>
          <p>No written reviews yet. Be the first to share your experience.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {list.map((review, idx) => (
            <article key={review.id || idx} className={styles.card}>
              <header className={styles.cardHead}>
                <div className={styles.user}>
                  <span className={styles.avatar}>
                    {(review.userName || review.name || "U").charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <span className={styles.userName}>
                      {review.userName || review.name || "Anonymous"}
                    </span>
                    {(review.isVerifiedPurchase || review.verified) && (
                      <span className={styles.verified}>✓ Verified Purchase</span>
                    )}
                  </div>
                </div>
                <span className={styles.date}>
                  {review.createdAt ? formatDate(review.createdAt, "short") : ""}
                </span>
              </header>

              <div className={styles.ratingLine}>
                <StarRating rating={Number(review.rating) || 0} size={14} />
                {review.title && <span className={styles.reviewTitle}>{review.title}</span>}
              </div>

              {(review.body || review.comment || review.text) && (
                <p className={styles.body}>
                  {review.body || review.comment || review.text}
                </p>
              )}

              {/* Customer photos (UGC) — only when the review really has them */}
              {Array.isArray(review.photos) && review.photos.length > 0 && (
                <div className={styles.photos}>
                  {review.photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Customer upload ${i + 1} from a verified buyer`}
                      loading="lazy"
                      onError={onImageError}
                      className={styles.photo}
                    />
                  ))}
                </div>
              )}

              {Number(review.helpfulCount) > 0 && (
                <div className={styles.helpful}>
                  {review.helpfulCount} found this helpful
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewsSection;

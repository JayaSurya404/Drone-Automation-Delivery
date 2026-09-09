import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  size?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  interactive = false,
  onRatingChange,
  size = 18,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
      {Array.from({ length: maxStars }).map((_, index) => {
        const starValue = index + 1;
        const isFilled = displayRating >= starValue;

        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onRatingChange && onRatingChange(starValue)}
            onMouseEnter={() => interactive && setHoverRating(starValue)}
            onMouseLeave={() => interactive && setHoverRating(null)}
            style={{
              cursor: interactive ? 'pointer' : 'default',
              padding: '0.1rem',
              color: isFilled ? '#fbbf24' : 'var(--text-tertiary)',
              transition: 'transform 0.15s ease',
              transform: interactive && hoverRating === starValue ? 'scale(1.2)' : 'none',
            }}
          >
            <Star
              size={size}
              fill={isFilled ? '#fbbf24' : 'none'}
              strokeWidth={2}
            />
          </button>
        );
      })}
    </div>
  );
};

import React, { useState } from 'react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackType?: 'drone' | 'product' | 'avatar';
}

const FALLBACK_URLS = {
  drone: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f10c?auto=format&fit=crop&w=800&q=80',
  product: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=400&q=80',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
};

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = '',
  fallbackType = 'drone',
  className = '',
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState<string>(src || FALLBACK_URLS[fallbackType]);
  const [isError, setIsError] = useState(false);

  const handleError = () => {
    if (!isError) {
      setIsError(true);
      setImgSrc(FALLBACK_URLS[fallbackType]);
    }
  };

  return (
    <img
      src={imgSrc || FALLBACK_URLS[fallbackType]}
      alt={alt}
      onError={handleError}
      className={className}
      {...props}
    />
  );
};

(function initImageUtils(globalScope) {
  const PLACEHOLDER = 'assets/placeholder.svg';

  function isValidHttpUrl(value) {
    try {
      const parsed = new URL(String(value || '').trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function normalizeImageList(values = []) {
    const unique = new Set();

    return (Array.isArray(values) ? values : [values])
      .map((item) => String(item || '').trim())
      .filter((item) => {
        if (!item || unique.has(item) || !isValidHttpUrl(item)) return false;
        unique.add(item);
        return true;
      });
  }

  function getPropertyImages(property = {}) {
    const fromImages = normalizeImageList(property.images);
    if (fromImages.length) return fromImages;

    const cover = normalizeImageList([property.coverImage]);
    if (cover.length) return cover;

    const legacy = normalizeImageList([
      property.image,
      property.imagen,
      ...(Array.isArray(property.imagenes) ? property.imagenes : [])
    ]);

    return legacy;
  }

  function getCoverImage(property = {}) {
    const images = getPropertyImages(property);
    if (!images.length) return PLACEHOLDER;

    const explicitCover = String(property.coverImage || '').trim();
    return images.includes(explicitCover) ? explicitCover : images[0];
  }

  globalScope.inmoImageUtils = {
    PLACEHOLDER,
    isValidHttpUrl,
    normalizeImageList,
    getPropertyImages,
    getCoverImage
  };
})(window);

(function initInmoVideoUtils(globalScope) {
  function normalizeVideoType(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'youtube' || normalized === 'tiktok') return normalized;
    return '';
  }

  function toSafeUrl(value = '') {
    const candidate = String(value || '').trim();
    if (!candidate) return '';
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.toString();
    } catch (error) {
      return '';
    }
  }

  function extractYouTubeVideoId(url = '') {
    const safeUrl = toSafeUrl(url);
    if (!safeUrl) return '';

    try {
      const parsed = new URL(safeUrl);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
        return parsed.pathname.replace('/', '').trim();
      }

      if (hostname.includes('youtube.com')) {
        if (parsed.pathname.startsWith('/shorts/')) {
          return parsed.pathname.split('/')[2] || '';
        }

        if (parsed.pathname.startsWith('/embed/')) {
          return parsed.pathname.split('/')[2] || '';
        }

        return parsed.searchParams.get('v') || '';
      }
    } catch (error) {
      return '';
    }

    return '';
  }

  function getYouTubeEmbedUrl(url = '') {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) return '';
    return `https://www.youtube.com/embed/${videoId}`;
  }

  function extractTikTokVideoId(url = '') {
    const safeUrl = toSafeUrl(url);
    if (!safeUrl) return '';

    try {
      const parsed = new URL(safeUrl);
      if (!parsed.hostname.toLowerCase().includes('tiktok.com')) return '';
      const match = parsed.pathname.match(/\/video\/(\d+)/i);
      return match?.[1] || '';
    } catch (error) {
      return '';
    }
  }

  function getTikTokEmbedUrl(url = '') {
    const videoId = extractTikTokVideoId(url);
    if (!videoId) return '';
    return `https://www.tiktok.com/embed/v2/${videoId}`;
  }

  function isUrlValidForType(type = '', url = '') {
    const safeType = normalizeVideoType(type);
    const safeUrl = toSafeUrl(url);
    if (!safeType || !safeUrl) return false;

    if (safeType === 'youtube') return Boolean(extractYouTubeVideoId(safeUrl));
    if (safeType === 'tiktok') return safeUrl.toLowerCase().includes('tiktok.com/');
    return false;
  }

  function getPropertyVideoData(property = {}) {
    const nestedVideo = property.video && typeof property.video === 'object' ? property.video : null;
    const type = normalizeVideoType(
      nestedVideo?.type
      || property.videoType
      || ''
    );
    const url = toSafeUrl(
      nestedVideo?.url
      || property.videoUrl
      || (typeof property.video === 'string' ? property.video : '')
    );
    const inferredType = type || (extractYouTubeVideoId(url) ? 'youtube' : (url.toLowerCase().includes('tiktok.com/') ? 'tiktok' : ''));
    if (!inferredType || !url || !isUrlValidForType(inferredType, url)) return null;

    return {
      type: inferredType,
      url,
      embedUrl: inferredType === 'youtube' ? getYouTubeEmbedUrl(url) : getTikTokEmbedUrl(url)
    };
  }

  function validatePropertyVideoForm({ type = '', url = '' } = {}) {
    const normalizedType = normalizeVideoType(type);
    const safeUrl = String(url || '').trim();

    if (!normalizedType && !safeUrl) {
      return { valid: true, value: null };
    }

    if (normalizedType && !safeUrl) {
      return { valid: false, message: 'Seleccionaste un tipo de video. Ingresa la URL del video.' };
    }

    if (!normalizedType && safeUrl) {
      return { valid: false, message: 'Selecciona el tipo de video (YouTube o TikTok) para continuar.' };
    }

    if (!isUrlValidForType(normalizedType, safeUrl)) {
      if (normalizedType === 'youtube') {
        return { valid: false, message: 'La URL no corresponde a YouTube. Usa enlaces youtube.com o youtu.be.' };
      }
      return { valid: false, message: 'La URL no corresponde a TikTok. Usa un enlace público de tiktok.com.' };
    }

    return {
      valid: true,
      value: {
        type: normalizedType,
        url: toSafeUrl(safeUrl)
      }
    };
  }

  globalScope.inmoVideoUtils = {
    normalizeVideoType,
    getYouTubeEmbedUrl,
    getTikTokEmbedUrl,
    validatePropertyVideoForm,
    getPropertyVideoData
  };
})(window);

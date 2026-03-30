(function attachPropertyUtils(global) {
  const USD_TO_NIO_RATE = 36.6243;

  const PROPERTY_TYPE_ALIASES = {
    house: ['house', 'casa', 'casas'],
    apartment: ['apartment', 'apartamento', 'apartamentos'],
    land: ['land', 'terreno', 'terrenos'],
    warehouse: ['warehouse', 'bodega', 'bodegas'],
    farm: ['farm', 'finca', 'fincas'],
    quinta: ['quinta', 'quintas'],
    beach_house: ['beach_house', 'beach-house', 'beach house', 'casa cerca del mar', 'casas cerca del mar', 'casa_cerca_del_mar']
  };

  const PROPERTY_TYPE_LABELS = {
    house: 'Casa',
    apartment: 'Apartamento',
    land: 'Terreno',
    warehouse: 'Bodega',
    farm: 'Finca',
    quinta: 'Quinta',
    beach_house: 'Casa cerca del mar'
  };

  const AREA_UNITS = ['metros', 'varas', 'manzanas'];
  const AREA_UNIT_SINGULAR = {
    metros: 'metro',
    varas: 'vara',
    manzanas: 'manzana'
  };

  const typeLookup = Object.entries(PROPERTY_TYPE_ALIASES).reduce((acc, [canonical, aliases]) => {
    aliases.forEach((value) => {
      acc[String(value).trim().toLowerCase()] = canonical;
    });
    return acc;
  }, {});

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function normalizePropertyType(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return typeLookup[normalized] || normalized;
  }

  function getPropertyTypeLabel(type = '') {
    const normalized = normalizePropertyType(type);
    return PROPERTY_TYPE_LABELS[normalized] || '';
  }

  function normalizeOperation(value = '') {
    return String(value || '').trim().toLowerCase();
  }

  function convertUsdToNio(usd) {
    const amount = toNumber(usd);
    if (!Number.isFinite(amount)) return NaN;
    return amount * USD_TO_NIO_RATE;
  }

  function formatUsd(usd, decimals = 0) {
    const amount = toNumber(usd);
    if (!Number.isFinite(amount)) return '';
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} USD`;
  }

  function formatNio(nio, decimals = 2) {
    const amount = toNumber(nio);
    if (!Number.isFinite(amount)) return '';
    return `C$${amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })} NIO`;
  }

  function formatDualPrice(usd) {
    const usdAmount = toNumber(usd);
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) return 'Precio no disponible';
    return `${formatUsd(usdAmount, 0)} - ${formatNio(convertUsdToNio(usdAmount), 2)}`;
  }

  function calculatePricePerArea(priceUsd, areaValue) {
    const price = toNumber(priceUsd);
    const area = toNumber(areaValue);
    if (!Number.isFinite(price) || !Number.isFinite(area) || price <= 0 || area <= 0) return NaN;
    return price / area;
  }

  function normalizeAreaUnit(unit = '') {
    const normalized = String(unit || '').trim().toLowerCase();
    return AREA_UNITS.includes(normalized) ? normalized : '';
  }

  function formatPricePerArea(pricePerAreaUsd, areaUnit = '') {
    const value = toNumber(pricePerAreaUsd);
    const normalizedUnit = normalizeAreaUnit(areaUnit);
    if (!Number.isFinite(value) || value <= 0 || !normalizedUnit) return 'Precio por área no disponible';

    return `${formatUsd(value, 2)} / ${AREA_UNIT_SINGULAR[normalizedUnit] || normalizedUnit}`;
  }

  function getPriceUsd(property = {}) {
    const price = toNumber(property.priceUsd ?? property.price ?? property.precio);
    return Number.isFinite(price) ? price : NaN;
  }

  function getAreaValue(property = {}) {
    const area = toNumber(property.areaValue ?? property.area);
    return Number.isFinite(area) ? area : NaN;
  }

  function getAreaDisplay(property = {}) {
    const areaValue = getAreaValue(property);
    const areaUnit = normalizeAreaUnit(property.areaUnit || '');

    if (Number.isFinite(areaValue) && areaValue > 0 && areaUnit) {
      return `${areaValue.toLocaleString('en-US')} ${areaUnit}`;
    }

    if (typeof property.area === 'string' && property.area.trim()) {
      return property.area.trim();
    }

    if (Number.isFinite(areaValue) && areaValue > 0) {
      return `${areaValue.toLocaleString('en-US')} m²`;
    }

    return 'Área no especificada';
  }

  function getPricePerAreaUsd(property = {}) {
    const stored = toNumber(property.pricePerAreaUsd);
    if (Number.isFinite(stored) && stored > 0) return stored;
    return calculatePricePerArea(getPriceUsd(property), getAreaValue(property));
  }

  global.inmoPropertyUtils = {
    USD_TO_NIO_RATE,
    PROPERTY_TYPE_LABELS,
    AREA_UNITS,
    normalizePropertyType,
    getPropertyTypeLabel,
    normalizeOperation,
    normalizeAreaUnit,
    convertUsdToNio,
    formatDualPrice,
    calculatePricePerArea,
    formatPricePerArea,
    getPriceUsd,
    getAreaValue,
    getAreaDisplay,
    getPricePerAreaUsd
  };
})(window);

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  HOT_COUNTRY_OPTIONS,
  countryToLocationPayload,
  findCountryFocus,
  getCountrySuggestions,
} from "@/lib/countryFocus";
import { GlobalPrayerRoomEmbed } from "@/components/GlobalPrayerRoom";

const TEXT = {
  approximateLocation: "\u5927\u81f4\u4f4d\u7f6e",
  chooseApproximateLocation: "\u9078\u53d6\u5927\u81f4\u4f4d\u7f6e",
  dragHint:
    "\u62d6\u66f3\u5730\u5716\u8abf\u6574\u4e2d\u5fc3\u9ede\u3002\u9001\u51fa\u6642\u6703\u4fdd\u5b58\u76ee\u524d\u4e2d\u5fc3\u4f4d\u7f6e\u3002",
  resetTaipei: "\u56de\u5230\u53f0\u5317",
  dragMapAria: "\u62d6\u66f3\u5730\u5716\u8abf\u6574\u5927\u81f4\u4f4d\u7f6e",
  zoomControls: "\u5730\u5716\u7e2e\u653e\u63a7\u5236",
  currentPosition: "\u76ee\u524d\u4fdd\u5b58\u4f4d\u7f6e\uff1a",
  searchCountry: "搜尋國家或地區",
  searchPlaceholder: "輸入國家，例如：約旦、Jordan、France",
  searchAction: "前往",
  searchNotFound: "暫時找不到相符國家。請確認拼字，或改用英文國名試試。",
  selectedPrefix: "已選擇：",
  approximatePrefix: "目前大致位置：",
};

const APPROXIMATE_LOCATION_LABEL = TEXT.approximateLocation;
const TAIPEI_POINT = { lat: 25.033, lng: 121.5654 };
const DEFAULT_ZOOM = 5;
const MIN_ZOOM = 3;
const MAX_ZOOM = 16;
const TILE_SIZE = 256;
const VIRTUAL_MAP_WIDTH = 760;
const VIRTUAL_MAP_HEIGHT = 420;
const TILE_BUFFER_RATIO = 0.75;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundCoordinate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toFixed(6);
}

function normalizePoint(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return TAIPEI_POINT;
  return {
    lat: clamp(lat, -85.0511, 85.0511),
    lng: ((lng + 540) % 360) - 180,
  };
}

function latLngToWorld(lat, lng, zoom) {
  const size = TILE_SIZE * 2 ** zoom;
  const safeLat = clamp(Number(lat), -85.0511, 85.0511);
  const sinLat = Math.sin((safeLat * Math.PI) / 180);

  return {
    x: ((Number(lng) + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size,
    size,
  };
}

function worldToLatLng(x, y, zoom) {
  const size = TILE_SIZE * 2 ** zoom;
  const lng = (x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / size;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return normalizePoint({ lat, lng });
}

function buildMapTiles(point, zoom) {
  const center = latLngToWorld(point.lat, point.lng, zoom);
  const bufferX = VIRTUAL_MAP_WIDTH * TILE_BUFFER_RATIO;
  const bufferY = VIRTUAL_MAP_HEIGHT * TILE_BUFFER_RATIO;
  const startX = center.x - VIRTUAL_MAP_WIDTH / 2;
  const startY = center.y - VIRTUAL_MAP_HEIGHT / 2;
  const renderStartX = startX - bufferX;
  const renderStartY = startY - bufferY;
  const renderWidth = VIRTUAL_MAP_WIDTH + bufferX * 2;
  const renderHeight = VIRTUAL_MAP_HEIGHT + bufferY * 2;
  const minTileX = Math.floor(renderStartX / TILE_SIZE);
  const maxTileX = Math.floor((renderStartX + renderWidth) / TILE_SIZE);
  const minTileY = Math.floor(renderStartY / TILE_SIZE);
  const maxTileY = Math.floor((renderStartY + renderHeight) / TILE_SIZE);
  const maxTile = 2 ** zoom;
  const tiles = [];

  for (let y = minTileY; y <= maxTileY; y += 1) {
    if (y < 0 || y >= maxTile) continue;

    for (let x = minTileX; x <= maxTileX; x += 1) {
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: ((x * TILE_SIZE - startX) / VIRTUAL_MAP_WIDTH) * 100,
        top: ((y * TILE_SIZE - startY) / VIRTUAL_MAP_HEIGHT) * 100,
        width: (TILE_SIZE / VIRTUAL_MAP_WIDTH) * 100,
        height: (TILE_SIZE / VIRTUAL_MAP_HEIGHT) * 100,
      });
    }
  }

  return { center, tiles };
}

function toLocationPayload(point, country = null) {
  if (country) {
    return countryToLocationPayload(country);
  }

  return {
    locationKey: "",
    locationCity: APPROXIMATE_LOCATION_LABEL,
    locationCountry: "",
    locationLat: roundCoordinate(point.lat),
    locationLng: roundCoordinate(point.lng),
  };
}

export default function PrayerLocationField({ disabled = false, onChange, value }) {
  const initialPoint = normalizePoint({
    lat: value?.locationLat || TAIPEI_POINT.lat,
    lng: value?.locationLng || TAIPEI_POINT.lng,
  });
  const initialCountry = findCountryFocus(value?.locationCountry || value?.locationCity || "");
  const [point, setPoint] = useState(initialPoint);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [countryQuery, setCountryQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [selectedLocationLabel, setSelectedLocationLabel] = useState(
    initialCountry?.localLabel || value?.locationCountry || value?.locationCity || ""
  );
  const dragRef = useRef(null);
  const pendingPointRef = useRef(null);
  const frameRef = useRef(null);
  const selectedCountryRef = useRef(initialCountry);
  const onChangeRef = useRef(onChange);
  const globeRef = useRef(null);

  const mapView = useMemo(() => buildMapTiles(point, zoom), [point, zoom]);
  const countrySuggestions = useMemo(
    () => getCountrySuggestions(countryQuery, 8),
    [countryQuery]
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!value?.locationLat || !value?.locationLng) return;
    const nextPoint = normalizePoint({ lat: value.locationLat, lng: value.locationLng });
    setPoint((current) => {
      if (
        Math.abs(Number(current.lat) - Number(nextPoint.lat)) < 0.000001 &&
        Math.abs(Number(current.lng) - Number(nextPoint.lng)) < 0.000001
      ) {
        return current;
      }
      return nextPoint;
    });
  }, [value?.locationLat, value?.locationLng]);

  useEffect(() => {
    onChangeRef.current(toLocationPayload(point, selectedCountryRef.current));
    globeRef.current?.focusLocation?.({ lat: point.lat, lng: point.lng, globeHeight: 2200000 });
  }, [point]);

  const selectedPrayer = useMemo(
    () => ({
      id: "create-location-preview",
      title: "目前選擇的位置",
      description: "建立代禱時使用的大致位置",
      locationCity: selectedLocationLabel || APPROXIMATE_LOCATION_LABEL,
      locationCountry: selectedCountryRef.current?.label || "",
      locationLat: point.lat,
      locationLng: point.lng,
      createdAt: new Date(0).toISOString(),
      isPrivate: false,
    }),
    [point, selectedLocationLabel]
  );

  useEffect(
    () => () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    },
    []
  );

  const updatePoint = (nextPoint) => {
    selectedCountryRef.current = null;
    setSelectedLocationLabel("");
    setPoint(normalizePoint(nextPoint));
  };

  const resetToTaipei = () => {
    setZoom(DEFAULT_ZOOM);
    updatePoint(TAIPEI_POINT);
  };

  const focusCountry = (country) => {
    if (!country) return;
    setCountryQuery(country.label);
    setSelectedLocationLabel(country.localLabel || country.label);
    setSearchMessage(`${TEXT.selectedPrefix}${country.localLabel || country.label}`);
    selectedCountryRef.current = country;
    setZoom(clamp(country.mapZoom || DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM));
    setPoint(normalizePoint({ lat: country.lat, lng: country.lng }));
    const payload = countryToLocationPayload(country);
    if (payload) onChangeRef.current(payload);
  };

  const handleCountrySearch = () => {
    if (disabled) return;
    const country = findCountryFocus(countryQuery);
    if (!country) {
      selectedCountryRef.current = null;
      setSelectedLocationLabel("");
      setSearchMessage(TEXT.searchNotFound);
      return;
    }
    focusCountry(country);
  };

  const handleCountrySearchKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleCountrySearch();
  };

  const changeZoom = (direction) => {
    setZoom((current) => clamp(current + direction, MIN_ZOOM, MAX_ZOOM));
  };

  const handlePointerDown = (event) => {
    if (disabled) return;
    if (event.pointerType !== "touch") {
      event.preventDefault();
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    setDragOffset({ x: 0, y: 0 });
    pendingPointRef.current = point;
    selectedCountryRef.current = null;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      center: mapView.center,
    };
  };

  const handlePointerMove = (event) => {
    if (!isDragging || disabled || !dragRef.current) return;
    if (event.pointerType !== "touch") {
      event.preventDefault();
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - dragRef.current.startX;
    const offsetY = event.clientY - dragRef.current.startY;
    const dx = (offsetX / rect.width) * VIRTUAL_MAP_WIDTH;
    const dy = (offsetY / rect.height) * VIRTUAL_MAP_HEIGHT;

    pendingPointRef.current = worldToLatLng(
      dragRef.current.center.x - dx,
      dragRef.current.center.y - dy,
      zoom
    );

    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setDragOffset({ x: offsetX, y: offsetY });
    });
  };

  const stopDragging = (event) => {
    if (!isDragging) return;
    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pendingPointRef.current) {
      setPoint(normalizePoint(pendingPointRef.current));
    }
    pendingPointRef.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    dragRef.current = null;
  };

  const handleWheel = (event) => {
    if (disabled) return;
    event.preventDefault();
    changeZoom(event.deltaY > 0 ? -1 : 1);
  };

  return (
    <section className="prayer-location" aria-label={TEXT.chooseApproximateLocation}>
      <div className="prayer-location__header">
        <div>
          <strong>{TEXT.approximateLocation}</strong>
          <p>{TEXT.dragHint}</p>
        </div>
        <button type="button" onClick={resetToTaipei} disabled={disabled}>
          {TEXT.resetTaipei}
        </button>
      </div>

      <div className="prayer-location__search" role="search">
        <label htmlFor="prayer-location-country">搜尋國家或地區</label>
        <div>
          <input
            id="prayer-location-country"
            list="prayer-location-country-options"
            value={countryQuery}
            onChange={(event) => {
              setCountryQuery(event.target.value);
              setSearchMessage("");
            }}
            placeholder={TEXT.searchPlaceholder}
            disabled={disabled}
            autoComplete="off"
            onKeyDown={handleCountrySearchKeyDown}
          />
          <datalist id="prayer-location-country-options">
            {countrySuggestions.map((country) => (
              <option
                key={country.key}
                value={country.label}
                label={country.localLabel ? `${country.localLabel} / ${country.label}` : country.label}
              />
            ))}
          </datalist>
          <button type="button" onClick={handleCountrySearch} disabled={disabled}>
            前往
          </button>
        </div>
        {searchMessage ? <p role="status">{searchMessage}</p> : null}
      </div>

      <div className="prayer-location__hot-countries" aria-label="快速選擇國家">
        {HOT_COUNTRY_OPTIONS.map((country) => (
          <button
            key={country.key}
            type="button"
            onClick={() => focusCountry(country)}
            disabled={disabled}
          >
            {country.localLabel || country.label}
          </button>
        ))}
      </div>

      <div className="prayer-location__globe-wrap">
        <GlobalPrayerRoomEmbed
          prayers={[selectedPrayer]}
          title="選擇全球大致位置"
          isHero
          fullscreen
          heroMap
          focusPrayerId={selectedPrayer.id}
          externalGlobeRef={globeRef}
          onHeroLocationSelect={(nextPoint) => {
            if (!disabled) updatePoint(nextPoint);
          }}
        />
        <div className="prayer-location__globe-zoom" aria-label={TEXT.zoomControls}>
          <button type="button" onClick={() => globeRef.current?.zoomIn?.()} disabled={disabled}>+</button>
          <button type="button" onClick={() => globeRef.current?.zoomOut?.()} disabled={disabled}>−</button>
        </div>
        <p>拖曳旋轉地球，點一下地球表面即可選擇大致位置。</p>
      </div>

      <details className="prayer-location__precision-map">
        <summary>使用平面地圖精細調整</summary>
        <div className="prayer-location__map-wrap">
        <button
          type="button"
          className={`prayer-location__map${isDragging ? " is-dragging" : ""}`}
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onLostPointerCapture={stopDragging}
          onWheel={handleWheel}
          aria-label={TEXT.dragMapAria}
        >
          <span
            className="prayer-location__tiles"
            aria-hidden="true"
            style={{
              transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
            }}
          >
            {mapView.tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.src}
                alt=""
                draggable={false}
                style={{
                  left: `${tile.left}%`,
                  top: `${tile.top}%`,
                  width: `${tile.width}%`,
                  height: `${tile.height}%`,
                }}
              />
            ))}
          </span>
          <span className="prayer-location__pin" aria-hidden="true" />
          <span className="prayer-location__attribution" aria-hidden="true">
            OpenStreetMap
          </span>
        </button>

        <div className="prayer-location__zoom" aria-label={TEXT.zoomControls}>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            disabled={disabled || zoom >= MAX_ZOOM}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            disabled={disabled || zoom <= MIN_ZOOM}
          >
            -
          </button>
        </div>
        </div>
      </details>

      <p className="prayer-location__helper">
        {selectedLocationLabel
          ? `${TEXT.selectedPrefix}${selectedLocationLabel}`
          : `${TEXT.approximatePrefix}${roundCoordinate(point.lat)}, ${roundCoordinate(point.lng)}`}
      </p>

      <style jsx>{`
        .prayer-location {
          display: grid;
          gap: 0.75rem;
          border-radius: 16px;
          border: 1px solid rgba(125, 211, 252, 0.16);
          background: rgba(2, 10, 24, 0.28);
          padding: 0.7rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .prayer-location__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.85rem;
        }

        .prayer-location__header strong {
          color: #f8fafc;
          font-size: 1rem;
        }

        .prayer-location__header p,
        .prayer-location__helper {
          margin: 0.2rem 0 0;
          color: rgba(226, 232, 240, 0.76);
          font-size: 0.88rem;
          line-height: 1.5;
        }

        .prayer-location__header button,
        .prayer-location__search button,
        .prayer-location__hot-countries button,
        .prayer-location__zoom button {
          min-height: 40px;
          border-radius: 11px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: rgba(15, 23, 42, 0.72);
          color: #e2e8f0;
          cursor: pointer;
          font: inherit;
          font-weight: 800;
          padding: 0 0.85rem;
        }

        .prayer-location__search {
          display: grid;
          gap: 0.45rem;
          border: 1px solid rgba(125, 211, 252, 0.14);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.22);
          padding: 0.7rem;
        }

        .prayer-location__search label {
          color: #bae6fd;
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .prayer-location__search div {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.5rem;
        }

        .prayer-location__search input {
          min-width: 0;
          min-height: 40px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 11px;
          background: rgba(15, 23, 42, 0.72);
          color: #f8fafc;
          font: inherit;
          padding: 0 0.8rem;
        }

        .prayer-location__search input:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .prayer-location__search p {
          margin: 0;
          color: #bae6fd;
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.55;
        }

        .prayer-location__hot-countries {
          display: flex;
          flex-wrap: nowrap;
          gap: 0.45rem;
          overflow-x: auto;
          padding-bottom: 0.05rem;
          scrollbar-width: none;
        }

        .prayer-location__hot-countries::-webkit-scrollbar {
          display: none;
        }

        .prayer-location__hot-countries button {
          flex: 0 0 auto;
          min-width: 0;
          min-height: 36px;
          padding: 0 0.72rem;
          font-size: 0.86rem;
        }

        .prayer-location__map-wrap {
          position: relative;
        }

        .prayer-location__globe-wrap {
          position: relative;
          min-height: clamp(360px, 52vw, 520px);
          overflow: hidden;
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 18px;
          background: #020817;
        }

        .prayer-location__globe-wrap :global(.global-room-embed--hero) {
          position: absolute;
          inset: 0;
        }

        .prayer-location__globe-wrap :global(.global-room__canvas) {
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          border-radius: 0 !important;
        }

        .prayer-location__globe-wrap > p {
          position: absolute;
          z-index: 5;
          left: 0.75rem;
          bottom: 0.65rem;
          margin: 0;
          border-radius: 999px;
          padding: 0.38rem 0.68rem;
          color: rgba(240, 249, 255, 0.92);
          background: rgba(2, 6, 23, 0.7);
          font-size: 0.78rem;
          pointer-events: none;
        }

        .prayer-location__globe-zoom {
          position: absolute;
          z-index: 6;
          top: 0.65rem;
          right: 0.65rem;
          display: grid;
          gap: 0.35rem;
        }

        .prayer-location__globe-zoom button {
          width: 42px;
          min-height: 42px;
          border: 1px solid rgba(186, 230, 253, 0.32);
          border-radius: 50%;
          color: #f8fafc;
          background: rgba(2, 6, 23, 0.76);
          font-size: 1.15rem;
          cursor: pointer;
        }

        .prayer-location__precision-map {
          border: 1px solid rgba(125, 211, 252, 0.14);
          border-radius: 14px;
          padding: 0.65rem;
          color: rgba(226, 232, 240, 0.88);
          background: rgba(2, 6, 23, 0.22);
        }

        .prayer-location__precision-map summary {
          cursor: pointer;
          font-weight: 800;
        }

        .prayer-location__precision-map[open] summary {
          margin-bottom: 0.65rem;
        }

        .prayer-location__map {
          position: relative;
          width: 100%;
          aspect-ratio: 1.7;
          overflow: hidden;
          border: 1px solid rgba(56, 189, 248, 0.28);
          border-radius: 16px;
          background:
            radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.18), transparent 58%),
            rgba(15, 23, 42, 0.86);
          box-shadow: 0 18px 60px rgba(2, 6, 23, 0.32);
          cursor: grab;
          touch-action: pan-y;
          padding: 0;
        }

        .prayer-location__map.is-dragging {
          cursor: grabbing;
        }

        .prayer-location__tiles {
          position: absolute;
          inset: 0;
          z-index: 1;
          opacity: 0.9;
          will-change: transform;
          transform-origin: center;
        }

        .prayer-location__map::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          background:
            radial-gradient(circle at 50% 50%, transparent 0 42%, rgba(2, 6, 23, 0.2) 100%),
            linear-gradient(0deg, rgba(2, 6, 23, 0.18), transparent 38%);
        }

        .prayer-location__tiles img {
          position: absolute;
          object-fit: cover;
          user-select: none;
          -webkit-user-drag: none;
          backface-visibility: hidden;
        }

        .prayer-location__pin {
          position: absolute;
          z-index: 3;
          left: 50%;
          top: 50%;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #f8fafc;
          box-shadow:
            0 0 0 5px rgba(14, 165, 233, 0.35),
            0 0 28px rgba(125, 211, 252, 0.78);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .prayer-location__pin::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 38px;
          height: 38px;
          border: 1px solid rgba(248, 250, 252, 0.72);
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        .prayer-location__zoom {
          position: absolute;
          right: 0.6rem;
          top: 0.6rem;
          z-index: 3;
          display: grid;
          gap: 0.35rem;
        }

        .prayer-location__zoom button {
          width: 40px;
          padding: 0;
          font-size: 1.15rem;
        }

        .prayer-location__zoom button:disabled,
        .prayer-location__hot-countries button:disabled,
        .prayer-location__search button:disabled,
        .prayer-location__header button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .prayer-location__attribution {
          position: absolute;
          z-index: 3;
          right: 0.45rem;
          bottom: 0.35rem;
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.62);
          color: rgba(226, 232, 240, 0.8);
          font-size: 0.68rem;
          line-height: 1;
          padding: 0.25rem 0.42rem;
          pointer-events: none;
        }

        @media (max-width: 520px) {
          .prayer-location__header {
            flex-direction: column;
          }

          .prayer-location__header button {
            width: 100%;
          }

          .prayer-location__search div {
            grid-template-columns: 1fr;
          }

          .prayer-location__hot-countries button {
            flex: 0 0 auto;
          }

          .prayer-location__map {
            aspect-ratio: 1.32;
          }
        }
      `}</style>
    </section>
  );
}

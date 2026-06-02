"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { findCountryFocus } from "@/lib/countryFocus";
import { useAudio } from "@/context/AudioContext";
import { useAuthSession } from "@/hooks/useAuthSession";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";

const TAIPEI = {
  id: "__taipei",
  cityLabel: "台北",
  fullLabel: "台北，台灣",
  locationCity: "台北",
  locationCountry: "台灣",
  locationLat: 25.033,
  locationLng: 121.5654,
  latestCreatedAt: null,
  totalCount: 0,
  unansweredCount: 0,
  isDefaultFocus: true,
  prayers: [],
};

const TAIWAN_VIEW = {
  lng: 120.95,
  lat: 23.75,
  height: 1800000,
};

const TAIPEI_VIEW = {
  lng: 121.5654,
  lat: 25.033,
  height: 650000,
};

const WORLD_VIEW = {
  lng: 0,
  lat: 20,
  height: 18500000,
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PRIVATE_PRAYER_DESCRIPTION = "這個城市有人需要被守望。";
const URGENT_RESPONSE_THRESHOLD = 2;
const FULL_GLOBE_MIN_HEIGHT = 220000;
const FULL_GLOBE_MAX_HEIGHT = 22000000;
const HERO_GLOBE_MIN_HEIGHT = 380000;
const HERO_GLOBE_MAX_HEIGHT = 6500000;
const DETAIL_LABEL_HEIGHT = 3800000;
const HOTSPOT_ONLY_HEIGHT = 9500000;

const PRAYER_LAYERS = [
  { key: "war", label: "戰爭與衝突", color: "#7f1d1d", terms: ["war", "conflict", "politic", "politics", "world"] },
  { key: "disaster", label: "災害守望", color: "#f97316", terms: ["disaster", "earthquake", "flood", "fire"] },
  { key: "church", label: "教會與福音", color: "#f8fafc", terms: ["church", "gospel", "mission"] },
  { key: "personal", label: "個人代禱", color: "#60a5fa", terms: ["personal", "life"] },
  { key: "healing", label: "健康", color: "#60a5fa", terms: ["healing", "health", "medical", "健康"] },
  { key: "family", label: "家庭與關係", color: "#60a5fa", terms: ["family", "relationship"] },
  { key: "testimony", label: "見證", color: "#facc15", terms: ["testimony", "overcomer"] },
  { key: "audio", label: "語音禱告", color: "#22d3ee", terms: ["audio", "voice"] },
  { key: "urgent", label: "需要守望", color: "#ef4444", terms: ["urgent", "unanswered"] },
];

const LAYER_BY_KEY = PRAYER_LAYERS.reduce((acc, layer) => {
  acc[layer.key] = layer;
  return acc;
}, {});

const CESIUM_VERSION = "1.132.0";
const CESIUM_BASE_URL = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;
const DEFAULT_TILE_URL =
  process.env.NEXT_PUBLIC_CESIUM_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
let cesiumLoaderPromise = null;

function addResourceHint(rel, href, options = {}) {
  if (
    typeof document === "undefined" ||
    document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)
  ) {
    return;
  }

  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null) link.setAttribute(key, value);
  });
  document.head.appendChild(link);
}

function addCesiumResourceHints() {
  let tileOrigin = "https://tile.openstreetmap.org";
  try {
    tileOrigin = new URL(DEFAULT_TILE_URL, window.location.origin).origin;
  } catch {
    // Keep the default OSM preconnect when a custom template URL cannot be parsed.
  }

  // Warm the two slow external origins before the script and first map tiles are requested.
  addResourceHint("preconnect", "https://cdn.jsdelivr.net", { crossorigin: "" });
  addResourceHint("preconnect", tileOrigin, { crossorigin: "" });
  addResourceHint("preload", `${CESIUM_BASE_URL}Cesium.js`, { as: "script" });
  addResourceHint("preload", `${CESIUM_BASE_URL}Widgets/widgets.css`, { as: "style" });
}

function loadCesium() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cesium can only load in the browser."));
  }

  addCesiumResourceHints();

  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (cesiumLoaderPromise) return cesiumLoaderPromise;

  cesiumLoaderPromise = new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = CESIUM_BASE_URL;

    if (!document.querySelector(`link[href="${CESIUM_BASE_URL}Widgets/widgets.css"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${CESIUM_BASE_URL}Widgets/widgets.css`;
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector(`script[src="${CESIUM_BASE_URL}Cesium.js"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.Cesium), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `${CESIUM_BASE_URL}Cesium.js`;
    script.async = true;
    script.onload = () => {
      if (window.Cesium) resolve(window.Cesium);
      else reject(new Error("Cesium loaded but did not expose window.Cesium."));
    };
    script.onerror = () => reject(new Error("Cesium script failed to load."));
    document.head.appendChild(script);
  });

  return cesiumLoaderPromise;
}

function getClusterColor(Cesium, cluster) {
  const visibility = getClusterVisibility(cluster);
  if (cluster?.isDefaultFocus) return Cesium.Color.SKYBLUE;
  if (cluster?.primaryCategoryKey) {
    return Cesium.Color.fromCssColorString(getCategoryColor(cluster.primaryCategoryKey));
  }
  if (visibility === "private") return Cesium.Color.fromCssColorString("#bfdbfe");
  if (visibility === "mixed") return Cesium.Color.fromCssColorString("#86efac");
  if (cluster?.isFresh || cluster?.hasUnanswered) return Cesium.Color.fromCssColorString("#fde68a");
  return Cesium.Color.fromCssColorString("#7dd3fc");
}

function getClusterCameraHeight(cluster) {
  if (!cluster || cluster.isDefaultFocus) return 2600000;
  if (cluster.totalCount >= 10) return 1600000;
  return 2100000;
}

function createCesiumImageryProvider(Cesium) {
  return new Cesium.UrlTemplateImageryProvider({
    url: DEFAULT_TILE_URL,
    maximumLevel: 19,
    credit: "© OpenStreetMap contributors",
  });
}

function latLngToVector3(THREE, lat, lng, radius) {
  const phi = (90 - Number(lat)) * (Math.PI / 180);
  const theta = (Number(lng) + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createFallbackTexture(THREE, color = "#0b6d9c") {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEarthTexture(THREE) {
  return createFallbackTexture(THREE, "#0b6d9c");
}

function createCloudTexture(THREE) {
  return createFallbackTexture(THREE, "rgba(255,255,255,0.2)");
}

function createGlowTexture(THREE) {
  return createFallbackTexture(THREE, "#facc15");
}

function createClusterCanvas(_Cesium, color, count) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  const cssColor = color?.toCssColorString?.() || "#67e8f9";

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.arc(48, 48, 38, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(2, 6, 23, 0.82)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(48, 48, 34, 0, Math.PI * 2);
  ctx.strokeStyle = cssColor;
  ctx.lineWidth = 8;
  ctx.shadowColor = cssColor;
  ctx.shadowBlur = 18;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "800 26px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(Math.min(count, 99)), 48, 49);

  return canvas.toDataURL("image/png");
}

function getCreatedTime(item) {
  const value = item?.createdAt || item?.latestCreatedAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function formatRelativeTime(value) {
  const time = value ? new Date(value).getTime() : 0;
  if (!time) return "剛剛";

  const diff = Date.now() - time;
  if (diff < 60 * 60 * 1000) return "1 小時內";
  if (diff < ONE_DAY_MS) return `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))} 小時前`;
  if (diff < 7 * ONE_DAY_MS) return `${Math.max(1, Math.floor(diff / ONE_DAY_MS))} 天前`;

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}

function toPlainText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function getPrayerTitle(prayer) {
  if (!prayer) return "城市代禱";
  return prayer.isPrivate ? "匿名代禱" : prayer.title || "城市代禱";
}

function getPrayerDescription(prayer) {
  if (!prayer) return "";
  if (prayer.isPrivate) {
    return PRIVATE_PRAYER_DESCRIPTION;
  }
  return toPlainText(prayer.description);
}

function getClusterVisibility(cluster) {
  if (!cluster?.totalCount) return "default";
  if (cluster.privateCount === cluster.totalCount) return "private";
  if (cluster.privateCount > 0) return "mixed";
  return "public";
}

function getPrayerCategoryKey(prayer) {
  if (!prayer) return "personal";
  if (prayer.isUrgent) return "urgent";
  if (Number(prayer.audioCount || 0) > 0 || prayer.voiceHref) return "audio";

  const slug = String(prayer.category?.slug || prayer.category?.name || prayer.category || "")
    .trim()
    .toLowerCase();
  const text = `${slug} ${prayer.title || ""} ${prayer.description || ""}`.toLowerCase();

  for (const layer of PRAYER_LAYERS) {
    if (layer.key === "audio" || layer.key === "urgent") continue;
    if (layer.terms.some((term) => text.includes(term))) return layer.key;
  }

  return "personal";
}

function getCategoryLabel(key) {
  return LAYER_BY_KEY[key]?.label || "Personal";
}

function getCategoryColor(key) {
  return LAYER_BY_KEY[key]?.color || LAYER_BY_KEY.personal.color;
}

function getPrayerAudioCount(prayer) {
  return Number(prayer?.audioCount || 0) + (prayer?.voiceHref ? 1 : 0);
}

function getPrayerHeat(prayer) {
  return (
    1 +
    Number(prayer?.prayerCount || 0) +
    Number(prayer?.responseCount || 0) +
    getPrayerAudioCount(prayer) * 2
  );
}

function getClusterHeat(cluster) {
  return Number(cluster?.heatScore || cluster?.priority || cluster?.totalCount || 0);
}

function isMajorHotspot(cluster) {
  if (!cluster || cluster.isDefaultFocus) return true;
  return (
    Boolean(cluster.isUrgent) ||
    Boolean(cluster.isFresh) ||
    Number(cluster.audioCount || 0) > 0 ||
    getClusterHeat(cluster) >= 8 ||
    Number(cluster.totalCount || 0) >= 3
  );
}

function isPrayerUrgent(prayer) {
  if (!prayer) return false;
  const text = `${prayer.title || ""} ${prayer.description || ""} ${
    prayer.category?.slug || prayer.category?.name || ""
  }`.toLowerCase();
  return (
    Number(prayer.responseCount || 0) <= URGENT_RESPONSE_THRESHOLD ||
    text.includes("urgent") ||
    text.includes("緊急") ||
    text.includes("急")
  );
}

function getClusterToneLabel(cluster) {
  const visibility = getClusterVisibility(cluster);
  if (visibility === "private") return "匿名守望";
  if (visibility === "mixed") return "混合內容";
  if (cluster?.isFresh) return "最新";
  return "公開";
}

function distanceFromTaipei(cluster) {
  return Math.hypot(
    Number(cluster.locationLat) - TAIPEI.locationLat,
    Number(cluster.locationLng) - TAIPEI.locationLng
  );
}

function buildCityClusters(prayers) {
  const groups = new Map();

  prayers.forEach((prayer) => {
    const lat = Number(prayer?.locationLat);
    const lng = Number(prayer?.locationLng);
    if (!prayer?.locationCity || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const isApproximateLocation = prayer.locationCity === "\u5927\u81f4\u4f4d\u7f6e";
    const key = isApproximateLocation
      ? `approx::${lat.toFixed(3)}::${lng.toFixed(3)}`
      : `${prayer.locationCity}::${prayer.locationCountry || ""}`;
    const locationLabel = isApproximateLocation
      ? "\u5927\u81f4\u4f4d\u7f6e"
      : prayer.locationCountry
        ? `${prayer.locationCity}, ${prayer.locationCountry}`
        : prayer.locationCity;

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        cityLabel: locationLabel,
        fullLabel: locationLabel,
        locationCity: prayer.locationCity,
        locationCountry: prayer.locationCountry,
        locationLat: lat,
        locationLng: lng,
        latestCreatedAt: prayer.createdAt || null,
        totalCount: 0,
        privateCount: 0,
        unansweredCount: 0,
        prayers: [],
      });
    }

    const cluster = groups.get(key);
    const categoryKey = getPrayerCategoryKey(prayer);
    const audioCount = getPrayerAudioCount(prayer);
    const enrichedPrayer = {
      ...prayer,
      categoryKey,
      categoryLabel: getCategoryLabel(categoryKey),
      audioCount,
      prayerCount: Number(prayer.prayerCount || 1),
      heatScore: getPrayerHeat(prayer),
      isUrgent: isPrayerUrgent(prayer),
    };

    cluster.prayers.push(enrichedPrayer);
    cluster.totalCount += 1;
    cluster.heatScore = Number(cluster.heatScore || 0) + enrichedPrayer.heatScore;
    cluster.replyCount = Number(cluster.replyCount || 0) + Number(prayer.responseCount || 0);
    cluster.audioCount = Number(cluster.audioCount || 0) + audioCount;
    cluster.prayerCount = Number(cluster.prayerCount || 0) + enrichedPrayer.prayerCount;
    cluster.categoryCounts = cluster.categoryCounts || {};
    cluster.categoryCounts[categoryKey] = Number(cluster.categoryCounts[categoryKey] || 0) + 1;
    if (prayer.isPrivate) cluster.privateCount += 1;
    if (Number(prayer.responseCount ?? 0) === 0) cluster.unansweredCount += 1;
    if (getCreatedTime(prayer) > getCreatedTime(cluster)) {
      cluster.latestCreatedAt = prayer.createdAt || null;
    }
  });

  return Array.from(groups.values())
    .map((cluster) => {
      const latestTime = getCreatedTime(cluster);
      const isFresh = latestTime > 0 && Date.now() - latestTime <= ONE_DAY_MS;
      const hasUnanswered = cluster.unansweredCount > 0;
      const primaryCategoryKey =
        Object.entries(cluster.categoryCounts || {}).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "personal";
      const isUrgent = cluster.prayers.some((prayer) => prayer.isUrgent);

      return {
        ...cluster,
        isFresh,
        isUrgent,
        hasUnanswered,
        primaryCategoryKey,
        categoryLabel: getCategoryLabel(primaryCategoryKey),
        priority:
          (isFresh ? 100 : 0) +
          (isUrgent ? 60 : 0) +
          (hasUnanswered ? 24 : 0) +
          Number(cluster.heatScore || cluster.totalCount),
        prayers: cluster.prayers.sort((a, b) => getCreatedTime(b) - getCreatedTime(a)),
      };
    })
    .sort((a, b) => {
      const latestDiff = getCreatedTime(b) - getCreatedTime(a);
      if (latestDiff !== 0) return latestDiff;
      if (b.unansweredCount !== a.unansweredCount) return b.unansweredCount - a.unansweredCount;
      return b.totalCount - a.totalCount;
    });
}

const CesiumPrayerGlobe = forwardRef(function CesiumPrayerGlobe(
  { clusters, onSelectCluster, onAutoRotateChange, onReady },
  ref
) {
  const mountRef = useRef(null);
  const autoRotateRef = useRef(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function initGlobe() {
      try {
        setIsLoading(true);
        setLoadError("");

        const Cesium = await loadCesium();
        if (disposed || !mountRef.current) return;

        Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

        const viewer = new Cesium.Viewer(mountRef.current, {
          animation: false,
          timeline: false,
          fullscreenButton: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          imageryProvider: createCesiumImageryProvider(Cesium),
        });

        viewer.scene.globe.enableLighting = false;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 4500;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 42000000;
        viewer.scene.screenSpaceCameraController.enableTilt = true;
        viewer.scene.screenSpaceCameraController.enableLook = true;
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
        viewer.scene.screenSpaceCameraController.inertiaSpin = 0.34;
        viewer.scene.screenSpaceCameraController.inertiaZoom = 0.18;
        viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.08;
        viewer.cesiumWidget.creditContainer.style.display = "none";

        const markerSource = clusters.length ? clusters : [TAIPEI];
        const entities = markerSource.map((cluster) => {
          const color = getClusterColor(Cesium, cluster);
          const visibility = getClusterVisibility(cluster);
          const labelText =
            cluster.totalCount > 1
              ? `${cluster.cityLabel} ${cluster.totalCount}`
              : cluster.cityLabel;
          const pixelSize = cluster.isDefaultFocus
            ? 13
            : Math.min(28, 14 + Number(cluster.totalCount || 1) * 2.4);

          const entity = viewer.entities.add({
            name: cluster.fullLabel,
            position: Cesium.Cartesian3.fromDegrees(
              Number(cluster.locationLng),
              Number(cluster.locationLat),
              6500
            ),
            point: {
              color: color.withAlpha(0.94),
              pixelSize,
              outlineColor: Cesium.Color.WHITE.withAlpha(0.84),
              outlineWidth: visibility === "private" ? 2 : 3,
              scaleByDistance: new Cesium.NearFarScalar(250000, 1.7, 12000000, 0.55),
              translucencyByDistance: new Cesium.NearFarScalar(250000, 1, 17000000, 0.5),
              disableDepthTestDistance: 6500000,
            },
            label: {
              text: labelText,
              font: "700 15px 'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
              fillColor: Cesium.Color.WHITE,
              backgroundColor: Cesium.Color.fromCssColorString("#020617").withAlpha(0.74),
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(10, 7),
              pixelOffset: new Cesium.Cartesian2(0, -34),
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scaleByDistance: new Cesium.NearFarScalar(250000, 1, 9000000, 0.62),
              translucencyByDistance: new Cesium.NearFarScalar(250000, 1, 13000000, 0),
              disableDepthTestDistance: 6500000,
            },
          });
          entity.clusterData = cluster;
          return entity;
        });

        function setAutoRotate(value) {
          autoRotateRef.current = Boolean(value);
          onAutoRotateChange?.(Boolean(value));
        }

        function focusCluster(cluster, height = getClusterCameraHeight(cluster)) {
          if (!cluster) return;
          setAutoRotate(false);
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              Number(cluster.locationLng),
              Number(cluster.locationLat),
              height
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-62),
              roll: 0,
            },
            duration: 1.15,
          });
        }

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(() => setAutoRotate(false), Cesium.ScreenSpaceEventType.LEFT_DOWN);
        handler.setInputAction(() => setAutoRotate(false), Cesium.ScreenSpaceEventType.WHEEL);
        handler.setInputAction((movement) => {
          const picked = viewer.scene.pick(movement.position);
          const entity = picked?.id;
          const cluster = entity?.clusterData;
          if (cluster) {
            focusCluster(
              cluster,
              Math.max(viewer.camera.positionCartographic.height * 0.62, 260000)
            );
            onSelectCluster?.(cluster);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        const tick = () => {
          if (!autoRotateRef.current || viewer.camera.positionCartographic.height < 1800000) return;
          viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.00022);
        };
        if (!staticView) viewer.clock.onTick.addEventListener(tick);

        ref.current = {
          focusCluster,
          resetTaipei: () => focusCluster(TAIPEI, 2600000),
          zoomIn: () => {
            setAutoRotate(false);
            viewer.camera.zoomIn(Math.max(45000, viewer.camera.positionCartographic.height * 0.35));
          },
          zoomOut: () => {
            setAutoRotate(false);
            viewer.camera.zoomOut(
              Math.max(45000, viewer.camera.positionCartographic.height * 0.35)
            );
          },
          setAutoRotate,
        };

        setIsLoading(false);
        onReady?.();

        cleanup = () => {
          ref.current = null;
          if (!staticView) viewer.clock.onTick.removeEventListener(tick);
          handler.destroy();
          entities.forEach((entity) => viewer.entities.remove(entity));
          viewer.destroy();
        };
      } catch (error) {
        if (disposed) return;
        setIsLoading(false);
        setLoadError(error?.message || "真實地球載入失敗，請重新整理頁面。");
      }
    }

    initGlobe();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [clusters, onAutoRotateChange, onReady, onSelectCluster, ref]);

  return (
    <div ref={mountRef} className="global-room__canvas" aria-label="真實互動式全球代禱地球">
      {isLoading ? (
        <div className="global-room__loader" role="status" aria-live="polite">
          <span />
          <strong>正在載入真實地球與城市地圖</strong>
        </div>
      ) : null}
      {loadError ? (
        <div className="global-room__loader global-room__loader--error" role="alert">
          <strong>真實地球暫時無法載入</strong>
          <small>{loadError}</small>
        </div>
      ) : null}
      <style jsx>{`
        .global-room__canvas {
          position: relative;
          z-index: 1;
          width: min(920px, 96%);
          height: min(760px, 72vh);
          min-height: 520px;
          overflow: hidden;
          border-radius: 24px;
          cursor: grab;
          touch-action: none;
          background: radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.28), #020617 72%);
        }

        .global-room__canvas:active {
          cursor: grabbing;
        }

        .global-room__canvas.is-static-view {
          cursor: default;
          touch-action: pan-y;
        }

        .global-room__canvas.is-static-view:active {
          cursor: default;
        }

        .global-room__canvas.is-static-view canvas {
          touch-action: pan-y !important;
        }

        .global-room__canvas.is-hero-map {
          cursor: grab;
          touch-action: pan-y;
        }

        .global-room__canvas.is-hero-map:active {
          cursor: grabbing;
        }

        .global-room__canvas.is-hero-map canvas {
          touch-action: pan-y !important;
        }

        .global-room__canvas :global(.cesium-viewer),
        .global-room__canvas :global(.cesium-viewer-cesiumWidgetContainer),
        .global-room__canvas :global(.cesium-widget),
        .global-room__canvas :global(.cesium-widget canvas) {
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          outline: none;
          touch-action: none;
        }

        .global-room__canvas :global(.cesium-viewer-toolbar) {
          top: 16px;
          right: 16px;
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.62);
          border: 1px solid rgba(125, 211, 252, 0.22);
          backdrop-filter: blur(14px);
          padding: 6px;
        }

        .global-room__canvas :global(.cesium-geocoder-input) {
          background: rgba(2, 6, 23, 0.78);
          border-color: rgba(125, 211, 252, 0.3);
          color: #f8fafc;
        }

        .global-room__canvas :global(.cesium-widget-credits),
        .global-room__canvas :global(.cesium-credit-logoContainer) {
          display: none !important;
        }

        .global-room__loader {
          position: absolute;
          inset: 0;
          z-index: 8;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 0.85rem;
          color: #dff7ff;
          background: radial-gradient(circle, rgba(8, 47, 73, 0.78), rgba(2, 6, 23, 0.34));
          text-align: center;
        }

        .global-room__loader span {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 4px solid rgba(125, 211, 252, 0.2);
          border-top-color: #fef08a;
          animation: global-room-spin 0.9s linear infinite;
        }

        .global-room__loader--error {
          padding: 1rem;
          color: #fecaca;
        }

        .global-room__loader--error small {
          max-width: 360px;
          color: rgba(254, 202, 202, 0.82);
          line-height: 1.5;
        }

        @keyframes global-room-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .global-room__canvas {
            width: min(680px, 100%);
            height: min(650px, 70vh);
            min-height: 440px;
            border-radius: 18px;
          }
        }
      `}</style>
    </div>
  );
});

export function GlobalPrayerRoomSkeleton({ hidden }) {
  return (
    <div className={`global-room__skeleton${hidden ? " is-hidden" : ""}`} aria-hidden={hidden}>
      <div className="global-room__fake-orbit" />
      <div className="global-room__fake-globe">
        <span className="global-room__fake-shine" />
        <span className="global-room__fake-grid global-room__fake-grid--one" />
        <span className="global-room__fake-grid global-room__fake-grid--two" />
        <span className="global-room__fake-marker global-room__fake-marker--one" />
        <span className="global-room__fake-marker global-room__fake-marker--two" />
        <span className="global-room__fake-marker global-room__fake-marker--three" />
      </div>
      <p>正在載入全球禱告地球</p>
    </div>
  );
}

export const GlobalPrayerRoomOptimized = forwardRef(function GlobalPrayerRoomOptimized(
  {
    clusters,
    onSelectCluster,
    onAutoRotateChange,
    onReady,
    onBlankClick,
    onHoverCluster,
    staticView = false,
    heroMap = false,
  },
  ref
) {
  const mountRef = useRef(null);
  const entitiesRef = useRef([]);
  const activeEntityRef = useRef(null);
  const hoveredEntityRef = useRef(null);
  const autoRotateRef = useRef(true);
  const rotationReadyRef = useRef(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function initGlobe() {
      try {
        setGlobeReady(false);
        setLoadError("");

        const Cesium = await loadCesium();
        if (disposed || !mountRef.current) return;

        Cesium.Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

        const viewer = new Cesium.Viewer(mountRef.current, {
          animation: false,
          timeline: false,
          fullscreenButton: false,
          homeButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          navigationHelpButton: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayer: false,
          imageryProvider: false,
          shouldAnimate: true,
          skyBox: false,
        });

        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#082f49");
        viewer.scene.globe.enableLighting = false;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled = true;
        const controller = viewer.scene.screenSpaceCameraController;
        const isCompactViewport = window.matchMedia?.("(max-width: 767px)")?.matches;
        const minCameraHeight = heroMap ? HERO_GLOBE_MIN_HEIGHT : FULL_GLOBE_MIN_HEIGHT;
        const maxCameraHeight = heroMap ? HERO_GLOBE_MAX_HEIGHT : FULL_GLOBE_MAX_HEIGHT;
        if (staticView) {
          controller.enableInputs = false;
          controller.enableRotate = false;
          controller.enableTranslate = false;
          controller.enableZoom = false;
          controller.enableTilt = false;
          controller.enableLook = false;
        } else if (heroMap) {
          controller.enableInputs = true;
          controller.enableRotate = true;
          controller.enableZoom = true;
          controller.enableTranslate = false;
          controller.enableTilt = false;
          controller.enableLook = false;
          controller.minimumZoomDistance = minCameraHeight;
          controller.maximumZoomDistance = maxCameraHeight;
          controller.inertiaSpin = isCompactViewport ? 0.08 : 0.16;
          controller.inertiaTranslate = 0;
          controller.inertiaZoom = isCompactViewport ? 0.06 : 0.12;
          controller.maximumMovementRatio = isCompactViewport ? 0.018 : 0.032;
        } else {
          controller.enableInputs = true;
          controller.minimumZoomDistance = minCameraHeight;
          controller.maximumZoomDistance = maxCameraHeight;
          controller.enableRotate = true;
          controller.enableZoom = true;
          controller.enableTranslate = false;
          controller.enableTilt = false;
          controller.enableLook = false;
          controller.inertiaSpin = isCompactViewport ? 0.1 : 0.28;
          controller.inertiaTranslate = 0;
          controller.inertiaZoom = isCompactViewport ? 0.08 : 0.16;
          controller.maximumMovementRatio = isCompactViewport ? 0.018 : 0.036;
        }
        controller.enableCollisionDetection = true;
        viewer.cesiumWidget.creditContainer.style.display = "none";

        const entityCluster = viewer.entities?.cluster;
        if (entityCluster) {
          entityCluster.enabled = true;
          entityCluster.pixelRange = isCompactViewport ? 58 : 48;
          entityCluster.minimumClusterSize = 3;
          entityCluster.clusterEvent.addEventListener((clusteredEntities, cluster) => {
            const hottestEntity = clusteredEntities
              .map((item) => item.clusterData)
              .filter(Boolean)
              .sort((a, b) => getClusterHeat(b) - getClusterHeat(a))[0];
            const color = getClusterColor(Cesium, hottestEntity || {});
            cluster.label.show = true;
            cluster.label.text = String(clusteredEntities.length);
            cluster.label.font = "800 13px 'Noto Sans TC', 'Microsoft JhengHei', sans-serif";
            cluster.label.fillColor = Cesium.Color.WHITE;
            cluster.label.backgroundColor = Cesium.Color.fromCssColorString("#020617").withAlpha(0.82);
            cluster.label.showBackground = true;
            cluster.label.backgroundPadding = new Cesium.Cartesian2(8, 6);
            cluster.billboard.show = true;
            cluster.billboard.image = createClusterCanvas(Cesium, color, clusteredEntities.length);
            cluster.billboard.width = 34;
            cluster.billboard.height = 34;
          });
        }

        function buildTopDownView({ lng, lat, height }) {
          return {
            destination: Cesium.Cartesian3.fromDegrees(
              lng,
              lat,
              Math.min(maxCameraHeight, Math.max(minCameraHeight, height))
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-90),
              roll: 0,
            },
          };
        }

        function flyToLocation({ lng, lat, height, duration }) {
          viewer.camera.flyTo({
            ...buildTopDownView({ lng, lat, height }),
            duration: duration || (heroMap ? (isCompactViewport ? 1.45 : 1.75) : isCompactViewport ? 1.05 : 1.2),
            easingFunction: Cesium.EasingFunction.CUBIC_OUT,
          });
        }

        function focusLocation(location, fallbackHeight = 1800000) {
          const lng = Number(location?.lng);
          const lat = Number(location?.lat);
          const height = Number(location?.height || location?.globeHeight || fallbackHeight);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

          setAutoRotate(false);
          flyToLocation({
            lng,
            lat,
            height: Number.isFinite(height) ? height : fallbackHeight,
          });
        }

        // Put the camera somewhere useful before any network tiles exist, so first paint is not blank.
        if (heroMap) {
          viewer.camera.setView(buildTopDownView(TAIWAN_VIEW));
        } else {
          viewer.camera.setView({
            destination: staticView
              ? Cesium.Cartesian3.fromDegrees(TAIPEI_VIEW.lng, TAIPEI_VIEW.lat, 900000)
              : Cesium.Cartesian3.fromDegrees(TAIPEI.locationLng, TAIPEI.locationLat, 5800000),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(staticView ? -90 : -62),
              roll: 0,
            },
          });
        }

        function getCameraHeight() {
          return viewer.camera.positionCartographic.height;
        }

        function clampCameraHeight() {
          const cartographic = viewer.camera.positionCartographic;
          const height = cartographic.height;
          if (height >= minCameraHeight && height <= maxCameraHeight) return;

          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromRadians(
              cartographic.longitude,
              cartographic.latitude,
              Math.min(maxCameraHeight, Math.max(minCameraHeight, height))
            ),
            orientation: {
              heading: viewer.camera.heading,
              pitch: heroMap ? Cesium.Math.toRadians(-90) : viewer.camera.pitch,
              roll: 0,
            },
          });
        }

        function shouldShowPoint(cluster) {
          if (cluster?.isActive || cluster?.isHovered) return true;
          const height = getCameraHeight();
          if (height > HOTSPOT_ONLY_HEIGHT) return isMajorHotspot(cluster);
          return true;
        }

        function shouldShowLabel(cluster) {
          if (cluster?.isActive || cluster?.isHovered) return true;
          const height = getCameraHeight();
          if (height > DETAIL_LABEL_HEIGHT) return false;
          return isMajorHotspot(cluster) || height < 1800000;
        }

        const markerSource = clusters.length ? clusters : [TAIPEI];

        function addEntity(cluster, index = 0) {
          const color = getClusterColor(Cesium, cluster);
          const visibility = getClusterVisibility(cluster);
          const labelText =
            cluster.totalCount > 1
              ? `${cluster.cityLabel} ${cluster.totalCount}`
              : cluster.cityLabel;
          const heat = Math.max(1, Number(cluster.heatScore || cluster.totalCount || 1));
          const pixelSize = cluster.isDefaultFocus
            ? 13
            : Math.min(34, 11 + Math.sqrt(heat) * 3.7);
          const hasAudio = Number(cluster.audioCount || 0) > 0;
          const isHot = getClusterHeat(cluster) >= 10 || Number(cluster.totalCount || 0) >= 4;
          const pulseStrength = cluster.isUrgent ? 0.24 : cluster.isFresh ? 0.16 : hasAudio ? 0.1 : 0.035;
          const pulseSpeed = cluster.isUrgent ? 0.0032 : hasAudio ? 0.0046 : 0.0024;
          const pulseValue = () =>
            1 + Math.sin(Date.now() * pulseSpeed + index * 0.23) * pulseStrength;
          let entity;
          const stateBoost = () => {
            if (entity?.isActive) return 1.38;
            if (entity?.isHovered) return 1.18;
            return 1;
          };
          const ellipseColor = new Cesium.CallbackProperty(
            () =>
              entity?.isActive
                ? Cesium.Color.fromCssColorString("#fef08a").withAlpha(0.26)
                : color.withAlpha(
                    entity?.isHovered ? 0.24 : visibility === "private" ? 0.12 : 0.18
                  ),
            false
          );

          entity = viewer.entities.add({
            name: cluster.fullLabel,
            position: Cesium.Cartesian3.fromDegrees(
              Number(cluster.locationLng),
              Number(cluster.locationLat),
              6500
            ),
            point: {
              show: new Cesium.CallbackProperty(
                () => Boolean(entity?.isActive || entity?.isHovered || shouldShowPoint(cluster)),
                false
              ),
              color: new Cesium.CallbackProperty(
                () => color.withAlpha(entity?.isActive || entity?.isHovered || isHot ? 1 : 0.88),
                false
              ),
              pixelSize: new Cesium.CallbackProperty(
                () => pixelSize * pulseValue() * stateBoost(),
                false
              ),
              outlineColor: new Cesium.CallbackProperty(
                () =>
                  entity?.isActive || cluster.isUrgent
                    ? Cesium.Color.fromCssColorString("#fef08a").withAlpha(0.98)
                    : Cesium.Color.WHITE.withAlpha(entity?.isHovered ? 0.98 : 0.84),
                false
              ),
              outlineWidth: new Cesium.CallbackProperty(
                () =>
                  entity?.isActive
                    ? 5
                    : entity?.isHovered || cluster.isUrgent
                      ? 4
                      : visibility === "private"
                        ? 2
                        : 3,
                false
              ),
              scaleByDistance: new Cesium.NearFarScalar(250000, 1.5, 12000000, 0.42),
              translucencyByDistance: new Cesium.NearFarScalar(250000, 1, 17000000, 0.36),
              disableDepthTestDistance: 6500000,
            },
            ellipse: {
              show: new Cesium.CallbackProperty(
                () =>
                  Boolean(entity?.isActive || entity?.isHovered || shouldShowPoint(cluster)) &&
                  (cluster.isFresh || cluster.isUrgent || hasAudio || isHot || entity?.isActive),
                false
              ),
              semiMajorAxis: new Cesium.CallbackProperty(
                () =>
                  (cluster.isUrgent ? 54000 : hasAudio ? 43000 : isHot ? 36000 : 22000) *
                  (1 + Math.abs(pulseValue() - 1) * (hasAudio ? 1.9 : 1.35)) *
                  stateBoost(),
                false
              ),
              semiMinorAxis: new Cesium.CallbackProperty(
                () =>
                  (cluster.isUrgent ? 54000 : hasAudio ? 43000 : isHot ? 36000 : 22000) *
                  (1 + Math.abs(pulseValue() - 1) * (hasAudio ? 1.9 : 1.35)) *
                  stateBoost(),
                false
              ),
              material: new Cesium.ColorMaterialProperty(ellipseColor),
              height: 4000,
              outline: new Cesium.CallbackProperty(
                () => Boolean(entity?.isActive || cluster.isUrgent || hasAudio),
                false
              ),
              outlineColor: new Cesium.CallbackProperty(
                () =>
                  hasAudio && !cluster.isUrgent
                    ? Cesium.Color.fromCssColorString("#67e8f9").withAlpha(0.52)
                    : Cesium.Color.fromCssColorString("#fef08a").withAlpha(cluster.isUrgent ? 0.86 : 0.62),
                false
              ),
            },
            label: {
              show: new Cesium.CallbackProperty(
                () => Boolean(entity?.isActive || entity?.isHovered || shouldShowLabel(cluster)),
                false
              ),
              text: labelText,
              font: "700 15px 'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
              fillColor: Cesium.Color.WHITE,
              backgroundColor: Cesium.Color.fromCssColorString("#020617").withAlpha(0.74),
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(10, 7),
              pixelOffset: new Cesium.Cartesian2(0, -34),
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scaleByDistance: new Cesium.NearFarScalar(250000, 1, 9000000, 0.62),
              translucencyByDistance: new Cesium.NearFarScalar(250000, 1, 13000000, 0),
              disableDepthTestDistance: 6500000,
            },
          });

          entity.clusterData = cluster;
          entitiesRef.current.push(entity);
          return entity;
        }

        function setHoveredEntity(entity) {
          if (hoveredEntityRef.current === entity) return;
          if (hoveredEntityRef.current) hoveredEntityRef.current.isHovered = false;
          hoveredEntityRef.current = entity || null;
          if (hoveredEntityRef.current) hoveredEntityRef.current.isHovered = true;
          viewer.scene.canvas.style.cursor = entity ? "pointer" : staticView ? "default" : "grab";
          onHoverCluster?.(entity?.clusterData || null);
        }

        function setActiveCluster(cluster) {
          if (activeEntityRef.current) activeEntityRef.current.isActive = false;
          activeEntityRef.current =
            entitiesRef.current.find((entity) => entity.clusterData?.id === cluster?.id) || null;
          if (activeEntityRef.current) activeEntityRef.current.isActive = true;
        }

        function clearActiveCluster() {
          if (activeEntityRef.current) activeEntityRef.current.isActive = false;
          activeEntityRef.current = null;
        }

        // First batch is intentionally smaller on mobile so the hero can become useful quickly.
        const initialBatchSize = Math.min(isCompactViewport ? 28 : 45, markerSource.length);
        markerSource.slice(0, initialBatchSize).forEach(addEntity);

        const entityTimer = window.setTimeout(() => {
          if (disposed || viewer.isDestroyed()) return;
          markerSource.slice(initialBatchSize).forEach((cluster, index) => {
            addEntity(cluster, initialBatchSize + index);
          });
        }, 1200);

        function setAutoRotate(value) {
          autoRotateRef.current = staticView || heroMap ? false : Boolean(value);
          onAutoRotateChange?.(autoRotateRef.current);
        }

        function focusCluster(cluster, height = getClusterCameraHeight(cluster)) {
          if (!cluster) return;
          setActiveCluster(cluster);
          setAutoRotate(false);
          if (staticView) return;

          const lng = Number(cluster.locationLng);
          const lat = Number(cluster.locationLat);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

          if (heroMap) {
            flyToLocation({
              lng,
              lat,
              height: Math.min(maxCameraHeight, Math.max(minCameraHeight, height || TAIPEI_VIEW.height)),
            });
            return;
          }

          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              lng,
              lat,
              Math.min(maxCameraHeight, Math.max(minCameraHeight, height))
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-62),
              roll: 0,
            },
            duration: isCompactViewport ? 1.15 : 1.3,
            easingFunction: Cesium.EasingFunction.CUBIC_OUT,
          });
        }

        function addPrayerPoint(lat, lng, options = {}) {
          const cluster = {
            id: options.id || `manual-${Date.now()}`,
            cityLabel: options.cityLabel || options.label || "Prayer",
            fullLabel: options.fullLabel || options.cityLabel || options.label || "Prayer",
            locationLat: Number(lat),
            locationLng: Number(lng),
            totalCount: Number(options.totalCount || 1),
            isFresh: true,
            hasUnanswered: Boolean(options.hasUnanswered),
            prayers: [],
          };

          if (!Number.isFinite(cluster.locationLat) || !Number.isFinite(cluster.locationLng)) {
            return null;
          }

          return addEntity(cluster, entitiesRef.current.length);
        }

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        if (!staticView) {
          handler.setInputAction(() => setAutoRotate(false), Cesium.ScreenSpaceEventType.LEFT_DOWN);
          handler.setInputAction(() => setAutoRotate(false), Cesium.ScreenSpaceEventType.WHEEL);
          handler.setInputAction((movement) => {
            const picked = viewer.scene.pick(movement.endPosition);
            setHoveredEntity(picked?.id?.clusterData ? picked.id : null);
          }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        }
        handler.setInputAction((movement) => {
          const picked = viewer.scene.pick(movement.position);
          const cluster = picked?.id?.clusterData;

          if (cluster) {
            const currentHeight = viewer.camera.positionCartographic.height;
            const isAlreadyActive = activeEntityRef.current?.clusterData?.id === cluster.id;
            if (!isAlreadyActive) {
              focusCluster(
                cluster,
                heroMap
                  ? Math.max(currentHeight * 0.82, getClusterCameraHeight(cluster), 1400000)
                  : Math.max(currentHeight * 0.62, 260000)
              );
            }
            onSelectCluster?.(cluster);
          } else {
            clearActiveCluster();
            onBlankClick?.();
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        const tick = () => {
          if (
            !rotationReadyRef.current ||
            staticView ||
            heroMap ||
            !autoRotateRef.current ||
            viewer.camera.positionCartographic.height < 1800000
          ) {
            return;
          }

          viewer.scene.camera.rotate(
            Cesium.Cartesian3.UNIT_Z,
            isCompactViewport ? -0.000055 : -0.00012
          );
          clampCameraHeight();
        };
        viewer.clock.onTick.addEventListener(tick);

        const rotationFallbackTimer = window.setTimeout(() => {
          if (!disposed) rotationReadyRef.current = true;
        }, 1800);

        const imageryTimer = window.setTimeout(() => {
          if (disposed || viewer.isDestroyed()) return;

          // Delay OSM so slow first tile requests cannot block the initial Cesium globe render.
          viewer.imageryLayers.addImageryProvider(createCesiumImageryProvider(Cesium));

          const tileProgress = (remaining) => {
            if (remaining === 0) {
              rotationReadyRef.current = true;
              viewer.scene.globe.tileLoadProgressEvent.removeEventListener(tileProgress);
            }
          };
          viewer.scene.globe.tileLoadProgressEvent.addEventListener(tileProgress);
        }, 800);

        let hasShownFirstFrame = false;
        const showFirstFrame = () => {
          if (disposed || hasShownFirstFrame) return;
          hasShownFirstFrame = true;
          setGlobeReady(true);
          onReady?.();
        };
        const firstRender = () => {
          showFirstFrame();
          viewer.scene.postRender.removeEventListener(firstRender);
        };
        viewer.scene.postRender.addEventListener(firstRender);
        viewer.scene.postRender.addEventListener(clampCameraHeight);

        const firstRenderFallbackTimer = window.setTimeout(() => {
          // Some browsers can complete the first Cesium render during construction.
          showFirstFrame();
        }, 1600);

        ref.current = {
          addPrayerPoint,
          focusCluster,
          focusLocation,
          focusCountry: (country) => focusLocation(country, country?.globeHeight || 1800000),
          clearActiveCluster,
          resetView: () => {
            setAutoRotate(false);
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(
                WORLD_VIEW.lng,
                WORLD_VIEW.lat,
                WORLD_VIEW.height
              ),
              orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-62),
                roll: 0,
              },
              duration: 1.1,
              easingFunction: Cesium.EasingFunction.CUBIC_OUT,
            });
          },
          resetTaipei: () => {
            setAutoRotate(false);
            flyToLocation(TAIPEI_VIEW);
          },
          resetHeroTaipei: () => {
            setAutoRotate(false);
            flyToLocation(TAIPEI_VIEW);
          },
          showTaiwan: () => {
            setAutoRotate(false);
            flyToLocation(TAIWAN_VIEW);
          },
          showAllMarkers: () => {
            setAutoRotate(false);
            if (!entitiesRef.current.length) {
              flyToLocation(TAIWAN_VIEW);
              return;
            }
            viewer.flyTo(entitiesRef.current, {
              duration: 1.05,
              offset: new Cesium.HeadingPitchRange(
                0,
                Cesium.Math.toRadians(-90),
                Math.min(maxCameraHeight, Math.max(2400000, 5000000))
              ),
            });
          },
          zoomIn: () => {
            if (staticView) return;
            setAutoRotate(false);
            viewer.camera.zoomIn(
              Math.max(45000, viewer.camera.positionCartographic.height * (heroMap ? 0.24 : 0.35))
            );
          },
          zoomOut: () => {
            if (staticView) return;
            setAutoRotate(false);
            viewer.camera.zoomOut(
              Math.max(45000, viewer.camera.positionCartographic.height * (heroMap ? 0.24 : 0.35))
            );
          },
          setAutoRotate,
        };

        cleanup = () => {
          window.clearTimeout(entityTimer);
          window.clearTimeout(imageryTimer);
          window.clearTimeout(rotationFallbackTimer);
          window.clearTimeout(firstRenderFallbackTimer);
          ref.current = null;
          viewer.clock.onTick.removeEventListener(tick);
          viewer.scene.postRender.removeEventListener(firstRender);
          viewer.scene.postRender.removeEventListener(clampCameraHeight);
          handler?.destroy();
          activeEntityRef.current = null;
          hoveredEntityRef.current = null;
          entitiesRef.current.forEach((entity) => viewer.entities.remove(entity));
          entitiesRef.current = [];
          viewer.destroy();
        };
      } catch (error) {
        if (disposed) return;
        setGlobeReady(true);
        setLoadError(error?.message || "全球禱告地球載入失敗，請稍後再試。");
      }
    }

    initGlobe();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [
    clusters,
    heroMap,
    onAutoRotateChange,
    onBlankClick,
    onHoverCluster,
    onReady,
    onSelectCluster,
    ref,
    staticView,
  ]);

  return (
    <div
      ref={mountRef}
      className={`global-room__canvas${globeReady ? " is-ready" : ""}${staticView ? " is-static-view" : ""}${heroMap ? " is-hero-map" : ""}`}
      aria-label="真實互動式全球代禱地球"
    >
      <GlobalPrayerRoomSkeleton hidden={globeReady && !loadError} />
      {loadError ? (
        <div className="global-room__loader global-room__loader--error" role="alert">
          <strong>全球禱告地球暫時無法載入</strong>
          <small>{loadError}</small>
        </div>
      ) : null}
      <style jsx global>{`
        .global-room__canvas {
          position: relative;
          z-index: 1;
          width: min(920px, 96%);
          height: min(760px, 72vh);
          min-height: 520px;
          overflow: hidden;
          border-radius: 24px;
          cursor: grab;
          touch-action: none;
          background:
            radial-gradient(circle at 50% 42%, rgba(14, 165, 233, 0.28), transparent 38%), #020617;
        }

        .global-room__canvas:active {
          cursor: grabbing;
        }

        .global-room__canvas .cesium-viewer,
        .global-room__canvas .cesium-viewer-cesiumWidgetContainer,
        .global-room__canvas .cesium-widget,
        .global-room__canvas .cesium-widget canvas {
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          outline: none;
          touch-action: none;
        }

        .global-room__canvas .cesium-viewer {
          opacity: 1;
        }

        .global-room__canvas .cesium-viewer-toolbar,
        .global-room__canvas .cesium-geocoder-input,
        .global-room__canvas .cesium-widget-credits,
        .global-room__canvas .cesium-credit-logoContainer {
          display: none !important;
        }

        .global-room__skeleton {
          position: absolute;
          inset: 0;
          z-index: 7;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 1rem;
          overflow: hidden;
          color: #dff7ff;
          background:
            radial-gradient(circle at 50% 42%, rgba(8, 145, 178, 0.24), transparent 34%),
            radial-gradient(circle at 50% 52%, rgba(15, 23, 42, 0), #020617 74%);
          opacity: 1;
          transition:
            opacity 520ms ease,
            visibility 520ms ease;
        }

        .global-room__skeleton.is-hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .global-room__fake-globe {
          position: relative;
          width: min(360px, 62vw);
          aspect-ratio: 1;
          border-radius: 50%;
          overflow: hidden;
          background:
            linear-gradient(
              110deg,
              transparent 0 34%,
              rgba(125, 211, 252, 0.18) 35% 38%,
              transparent 39%
            ),
            radial-gradient(circle at 34% 28%, rgba(186, 230, 253, 0.2), transparent 19%),
            radial-gradient(circle at 68% 64%, rgba(34, 197, 94, 0.15), transparent 21%),
            radial-gradient(circle at 42% 54%, #0e7490, #082f49 48%, #020617 78%);
          border: 1px solid rgba(125, 211, 252, 0.34);
          box-shadow:
            0 0 36px rgba(56, 189, 248, 0.34),
            0 0 92px rgba(14, 165, 233, 0.18),
            inset -34px -22px 70px rgba(2, 6, 23, 0.8);
          animation: global-room-fake-globe 5.5s ease-in-out infinite;
        }

        .global-room__fake-orbit {
          position: absolute;
          width: min(460px, 76vw);
          aspect-ratio: 1;
          border: 1px solid rgba(125, 211, 252, 0.16);
          border-radius: 50%;
          transform: rotate(-18deg) scaleY(0.34);
          box-shadow: 0 0 34px rgba(125, 211, 252, 0.12);
        }

        .global-room__fake-shine,
        .global-room__fake-grid,
        .global-room__fake-marker {
          position: absolute;
          pointer-events: none;
        }

        .global-room__fake-shine {
          inset: 9% 12% auto auto;
          width: 28%;
          height: 28%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.26), transparent 64%);
        }

        .global-room__fake-grid {
          inset: 13%;
          border-radius: 50%;
          border: 1px solid rgba(186, 230, 253, 0.12);
        }

        .global-room__fake-grid--two {
          inset: 28% 4%;
          transform: rotate(90deg);
        }

        .global-room__fake-marker {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #fef08a;
          box-shadow:
            0 0 0 8px rgba(250, 204, 21, 0.12),
            0 0 24px rgba(250, 204, 21, 0.8);
          animation: global-room-fake-pulse 1.7s ease-in-out infinite;
        }

        .global-room__fake-marker--one {
          left: 61%;
          top: 42%;
        }

        .global-room__fake-marker--two {
          left: 35%;
          top: 52%;
          animation-delay: 0.35s;
        }

        .global-room__fake-marker--three {
          left: 51%;
          top: 28%;
          background: #bae6fd;
          animation-delay: 0.7s;
        }

        .global-room__skeleton p {
          margin: 0;
          color: rgba(224, 242, 254, 0.82);
          font-size: 0.9rem;
          font-weight: 800;
        }

        .global-room__loader {
          position: absolute;
          inset: 0;
          z-index: 8;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 0.85rem;
          color: #dff7ff;
          background: radial-gradient(circle, rgba(8, 47, 73, 0.78), rgba(2, 6, 23, 0.34));
          text-align: center;
        }

        .global-room__loader--error {
          padding: 1rem;
          color: #fecaca;
        }

        .global-room__loader--error small {
          max-width: 360px;
          color: rgba(254, 202, 202, 0.82);
          line-height: 1.5;
        }

        @keyframes global-room-fake-globe {
          0%,
          100% {
            transform: translateY(0) rotate(-3deg);
          }
          50% {
            transform: translateY(-8px) rotate(4deg);
          }
        }

        @keyframes global-room-fake-pulse {
          0%,
          100% {
            transform: scale(0.92);
            opacity: 0.72;
          }
          50% {
            transform: scale(1.18);
            opacity: 1;
          }
        }

        @media (max-width: 640px) {
          .global-room__canvas {
            width: min(680px, 100%);
            height: min(650px, 70vh);
            min-height: 440px;
            border-radius: 18px;
          }
        }
      `}</style>
    </div>
  );
});

const GlobalPrayerGlobe = GlobalPrayerRoomOptimized;

const LegacyPrayerGlobe = forwardRef(function LegacyPrayerGlobe(
  { clusters, onSelectCluster, onAutoRotateChange, onReady },
  ref
) {
  const mountRef = useRef(null);
  const labelsRef = useRef("");
  const [labels, setLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function initGlobe() {
      try {
        setIsLoading(true);
        setLoadError("");

        const [THREE, { OrbitControls }] = await Promise.all([
          import("three"),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);

        if (disposed || !mountRef.current) return;

        const mount = mountRef.current;
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x061525, 0.045);

        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
        camera.position.copy(latLngToVector3(THREE, TAIPEI.locationLat, TAIPEI.locationLng, 4.1));

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.className = "global-room__webgl";
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        renderer.domElement.style.maxWidth = "none";
        renderer.domElement.style.touchAction = "none";
        renderer.domElement.style.pointerEvents = "auto";
        renderer.domElement.setAttribute("aria-hidden", "true");
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.enablePan = false;
        controls.minDistance = 2.45;
        controls.maxDistance = 6.1;
        controls.rotateSpeed = 0.72;
        controls.zoomSpeed = 0.78;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.32;

        scene.add(new THREE.AmbientLight(0x9fd7ff, 1.18));
        const sun = new THREE.DirectionalLight(0xffffff, 2.35);
        sun.position.set(4.6, 2.8, 5.4);
        scene.add(sun);
        const rim = new THREE.DirectionalLight(0x22d3ee, 1.1);
        rim.position.set(-4.2, 1.4, -2.8);
        scene.add(rim);

        const earth = new THREE.Mesh(
          new THREE.SphereGeometry(1.55, 128, 96),
          new THREE.MeshStandardMaterial({
            map: createEarthTexture(THREE),
            roughness: 0.78,
            metalness: 0.03,
            emissive: new THREE.Color(0x06213b),
            emissiveIntensity: 0.2,
          })
        );
        scene.add(earth);

        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(1.58, 96, 64),
          new THREE.MeshStandardMaterial({
            map: createCloudTexture(THREE),
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          })
        );
        scene.add(clouds);

        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(1.66, 96, 64),
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.14,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
          })
        );
        scene.add(atmosphere);

        const stars = new THREE.BufferGeometry();
        const starPositions = [];
        for (let i = 0; i < 380; i += 1) {
          const radius = 8 + Math.random() * 13;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          starPositions.push(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
          );
        }
        stars.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
        scene.add(
          new THREE.Points(
            stars,
            new THREE.PointsMaterial({
              color: 0xbfe9ff,
              size: 0.025,
              transparent: true,
              opacity: 0.72,
            })
          )
        );

        const markerGroup = new THREE.Group();
        const markerTexture = createGlowTexture(THREE);
        const markerSource = clusters.length ? clusters : [TAIPEI];

        markerSource.forEach((cluster) => {
          const point = latLngToVector3(THREE, cluster.locationLat, cluster.locationLng, 1.64);
          const marker = new THREE.Group();
          marker.position.copy(point);
          marker.lookAt(point.clone().multiplyScalar(2));
          marker.userData.cluster = cluster;

          const isHot = cluster.isFresh || cluster.hasUnanswered;
          const visibility = getClusterVisibility(cluster);
          const coreColor = cluster.isDefaultFocus
            ? 0x7dd3fc
            : visibility === "private"
              ? 0xbae6fd
              : visibility === "mixed"
                ? 0xa7f3d0
                : isHot
                  ? 0xfef08a
                  : 0x9fe8ff;
          const glowColor = cluster.isDefaultFocus
            ? 0x7dd3fc
            : visibility === "private"
              ? 0x93c5fd
              : visibility === "mixed"
                ? 0x6ee7b7
                : isHot
                  ? 0xfff176
                  : 0x9fe8ff;
          const coreSize = cluster.isDefaultFocus
            ? 0.045
            : Math.min(0.105, 0.05 + cluster.totalCount * 0.009);
          const core = new THREE.Mesh(
            new THREE.SphereGeometry(coreSize, 24, 16),
            new THREE.MeshBasicMaterial({
              color: coreColor,
            })
          );
          core.userData.cluster = cluster;
          marker.add(core);

          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: markerTexture,
              color: glowColor,
              transparent: true,
              opacity: visibility === "private" ? 0.78 : isHot ? 1 : 0.68,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            })
          );
          const glowSize = cluster.isDefaultFocus
            ? 0.34
            : Math.min(0.76, (visibility === "private" ? 0.42 : 0.36) + cluster.totalCount * 0.04);
          sprite.scale.set(glowSize, glowSize, 1);
          sprite.userData.cluster = cluster;
          marker.add(sprite);

          if (visibility === "private" || visibility === "mixed") {
            const halo = new THREE.Sprite(
              new THREE.SpriteMaterial({
                map: markerTexture,
                color: visibility === "private" ? 0xbfdbfe : 0xa7f3d0,
                transparent: true,
                opacity: 0.32,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
              })
            );
            halo.scale.set(glowSize * 1.75, glowSize * 1.75, 1);
            halo.userData.cluster = cluster;
            marker.add(halo);
          }

          markerGroup.add(marker);
        });
        scene.add(markerGroup);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const downPosition = { x: 0, y: 0 };
        const desiredCameraPosition = { current: null };
        let frame = 0;
        let rafId = 0;

        function setAutoRotate(value) {
          controls.autoRotate = Boolean(value);
          onAutoRotateChange?.(Boolean(value));
        }

        function focusCluster(cluster, distance = camera.position.length()) {
          if (!cluster) return;
          setAutoRotate(false);
          desiredCameraPosition.current = latLngToVector3(
            THREE,
            cluster.locationLat,
            cluster.locationLng,
            distance
          );
        }

        function resize() {
          if (!mount.isConnected) return;
          const rect = mount.getBoundingClientRect();
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
        }

        function updateLabels() {
          const rect = renderer.domElement.getBoundingClientRect();
          const cameraDirection = camera.position.clone().normalize();
          const nextLabels = markerGroup.children
            .map((marker) => {
              const cluster = marker.userData.cluster;
              const world = new THREE.Vector3();
              marker.getWorldPosition(world);
              const visibility = world.clone().normalize().dot(cameraDirection);
              if (visibility < 0.14) return null;

              const projected = world.clone().project(camera);
              const x = (projected.x * 0.5 + 0.5) * rect.width;
              const y = (-projected.y * 0.5 + 0.5) * rect.height;
              if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;

              return {
                id: cluster.id,
                cityLabel: cluster.cityLabel,
                totalCount: cluster.totalCount,
                isFresh: cluster.isFresh,
                isDefaultFocus: cluster.isDefaultFocus,
                visibility: getClusterVisibility(cluster),
                left: x,
                top: y,
                opacity: Math.min(1, Math.max(0.35, visibility)),
              };
            })
            .filter(Boolean)
            .slice(0, 9);

          const signature = JSON.stringify(nextLabels);
          if (signature !== labelsRef.current) {
            labelsRef.current = signature;
            setLabels(nextLabels);
          }
        }

        function handlePointerDown(event) {
          downPosition.x = event.clientX;
          downPosition.y = event.clientY;
          setAutoRotate(false);
        }

        function handleClick(event) {
          const moved = Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y);
          if (moved > 7) return;

          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const intersects = raycaster.intersectObjects(markerGroup.children, true);
          const cluster = intersects.find((item) => item.object?.userData?.cluster)?.object
            ?.userData?.cluster;
          if (cluster) {
            focusCluster(cluster, Math.max(camera.position.length() * 0.9, controls.minDistance));
            onSelectCluster?.(cluster);
          }
        }

        const stopAutoRotate = () => setAutoRotate(false);
        controls.addEventListener("start", stopAutoRotate);
        renderer.domElement.addEventListener("pointerdown", handlePointerDown);
        renderer.domElement.addEventListener("click", handleClick);

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();

        ref.current = {
          focusCluster,
          resetTaipei: () => focusCluster(TAIPEI, 4.1),
          zoomIn: () => {
            setAutoRotate(false);
            desiredCameraPosition.current = camera.position
              .clone()
              .setLength(Math.max(controls.minDistance, camera.position.length() * 0.82));
          },
          zoomOut: () => {
            setAutoRotate(false);
            desiredCameraPosition.current = camera.position
              .clone()
              .setLength(Math.min(controls.maxDistance, camera.position.length() * 1.18));
          },
          setAutoRotate,
        };

        function animate() {
          if (disposed) return;

          clouds.rotation.y += 0.00065;
          atmosphere.rotation.y -= 0.00028;
          markerGroup.children.forEach((marker, index) => {
            const cluster = marker.userData.cluster;
            const speed = cluster?.isFresh ? 0.006 : 0.0035;
            const scale =
              1 + Math.sin(Date.now() * speed + index) * (cluster?.isFresh ? 0.18 : 0.1);
            marker.scale.setScalar(scale);
          });

          if (desiredCameraPosition.current) {
            camera.position.lerp(desiredCameraPosition.current, 0.09);
            if (camera.position.distanceTo(desiredCameraPosition.current) < 0.018) {
              camera.position.copy(desiredCameraPosition.current);
              desiredCameraPosition.current = null;
            }
          }

          controls.update();
          if (frame % 4 === 0) updateLabels();
          frame += 1;
          renderer.render(scene, camera);
          rafId = requestAnimationFrame(animate);
        }

        setIsLoading(false);
        onReady?.();
        animate();

        cleanup = () => {
          cancelAnimationFrame(rafId);
          ref.current = null;
          resizeObserver.disconnect();
          renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
          renderer.domElement.removeEventListener("click", handleClick);
          controls.removeEventListener("start", stopAutoRotate);
          controls.dispose();
          scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              materials.forEach((material) => {
                Object.values(material).forEach((value) => {
                  if (value?.isTexture) value.dispose();
                });
                material.dispose();
              });
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (error) {
        if (disposed) return;
        setIsLoading(false);
        setLoadError(error?.message || "地球載入失敗，請重新整理頁面。");
      }
    }

    initGlobe();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [clusters, onAutoRotateChange, onReady, onSelectCluster, ref]);

  return (
    <div ref={mountRef} className="global-room__canvas" aria-label="互動式全球禱告地球">
      {isLoading ? (
        <div className="global-room__loader" role="status" aria-live="polite">
          <span />
          <strong>正在載入 3D 地球</strong>
        </div>
      ) : null}
      {loadError ? (
        <div className="global-room__loader global-room__loader--error" role="alert">
          <strong>地球暫時無法載入</strong>
          <small>{loadError}</small>
        </div>
      ) : null}
      <div className="global-room__labels" aria-hidden="true">
        {labels.map((label) => (
          <span
            key={label.id}
            className={`global-room__label${label.isFresh ? " is-hot" : ""}${
              label.isDefaultFocus ? " is-default" : ""
            } is-${label.visibility}`}
            style={{
              left: `${label.left}px`,
              top: `${label.top}px`,
              opacity: label.opacity,
            }}
          >
            {label.cityLabel}
            {label.totalCount > 1 ? <b>{label.totalCount}</b> : null}
          </span>
        ))}
      </div>
      <style jsx>{`
        .global-room__canvas {
          position: relative;
          z-index: 1;
          width: min(820px, 96%);
          height: min(760px, 72vh);
          min-height: 480px;
          cursor: grab;
          touch-action: none;
        }

        .global-room__canvas:active {
          cursor: grabbing;
        }

        .global-room__canvas :global(canvas.global-room__webgl) {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          outline: none;
          touch-action: none;
        }

        .global-room__loader {
          position: absolute;
          inset: 0;
          z-index: 8;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 0.85rem;
          color: #dff7ff;
          background: radial-gradient(circle, rgba(8, 47, 73, 0.64), rgba(2, 6, 23, 0.1));
          text-align: center;
        }

        .global-room__loader span {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 4px solid rgba(125, 211, 252, 0.2);
          border-top-color: #fef08a;
          animation: global-room-spin 0.9s linear infinite;
        }

        .global-room__loader--error {
          padding: 1rem;
          color: #fecaca;
        }

        .global-room__loader--error small {
          max-width: 360px;
          color: rgba(254, 202, 202, 0.82);
          line-height: 1.5;
        }

        .global-room__labels {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .global-room__label {
          position: absolute;
          display: inline-flex;
          align-items: center;
          gap: 0.28rem;
          transform: translate(-50%, calc(-100% - 12px));
          border: 1px solid rgba(125, 211, 252, 0.34);
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.72);
          color: #dff7ff;
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
          padding: 0.28rem 0.52rem;
          font-size: 0.78rem;
          font-weight: 900;
          white-space: nowrap;
          backdrop-filter: blur(10px);
        }

        .global-room__label.is-hot {
          border-color: rgba(254, 240, 138, 0.6);
          color: #fef08a;
          box-shadow: 0 0 26px rgba(250, 204, 21, 0.34);
        }

        .global-room__label b {
          min-width: 1.25rem;
          border-radius: 999px;
          background: rgba(250, 204, 21, 0.22);
          padding: 0.06rem 0.28rem;
          text-align: center;
        }

        @keyframes global-room-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          .global-room__canvas {
            width: min(680px, 100%);
            height: min(650px, 70vh);
            min-height: 410px;
          }
        }
      `}</style>
    </div>
  );
});

function usePrayerClusters(prayers) {
  const locatedPrayers = useMemo(
    () =>
      prayers.filter(
        (prayer) =>
          prayer?.locationCity &&
          Number.isFinite(Number(prayer.locationLat)) &&
          Number.isFinite(Number(prayer.locationLng))
      ),
    [prayers]
  );

  const clusters = useMemo(() => buildCityClusters(locatedPrayers), [locatedPrayers]);
  const displayClusters = clusters.length ? clusters : [TAIPEI];
  const recent24Count = locatedPrayers.filter((prayer) => {
    const time = getCreatedTime(prayer);
    return time > 0 && Date.now() - time <= ONE_DAY_MS;
  }).length;
  const unansweredCount = locatedPrayers.filter(
    (prayer) => Number(prayer.responseCount ?? 0) === 0
  ).length;
  const nearestCluster = clusters.length
    ? [...clusters].sort((a, b) => distanceFromTaipei(a) - distanceFromTaipei(b))[0]
    : TAIPEI;
  const taipeiCluster =
    clusters.find(
      (cluster) =>
        cluster.locationCity === TAIPEI.locationCity &&
        Math.abs(Number(cluster.locationLat) - TAIPEI.locationLat) < 0.5 &&
        Math.abs(Number(cluster.locationLng) - TAIPEI.locationLng) < 0.5
    ) || TAIPEI;

  return {
    locatedPrayers,
    clusters,
    displayClusters,
    latestClusters: clusters.slice(0, 3),
    recent24Count,
    unansweredCount,
    nearestCluster,
    taipeiCluster,
  };
}

export function GlobalPrayerRoomEmbed({
  prayers = [],
  title = "全球禱告室",
  subtitle = "拖曳旋轉地球，查看世界各地正在被守望的代禱事項。",
  ctaHref = "/global-prayer-room",
  ctaLabel = "進入全球禱告室",
  isHero = false,
  fullscreen = false,
  focusPrayerId = null,
  activeClusterId = null,
  onHeroClusterSelect,
  onHeroReady,
  onHeroBlankClick,
  externalGlobeRef = null,
  heroMap = false,
}) {
  const internalGlobeRef = useRef(null);
  const globeRef = externalGlobeRef || internalGlobeRef;
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const { clusters, displayClusters, latestClusters, recent24Count, nearestCluster } =
    usePrayerClusters(prayers);
  const selectedPrayer = selectedCluster?.prayers?.[0] || null;

  useEffect(() => {
    setSelectedCluster((current) => current || nearestCluster);
  }, [nearestCluster]);

  const handleFocusCluster = useCallback(
    (cluster) => {
      setSelectedCluster(cluster);
      globeRef.current?.focusCluster?.(cluster);
    },
    [globeRef]
  );

  const handleSelectCluster = useCallback(
    (cluster) => {
      setSelectedCluster(cluster);
      onHeroClusterSelect?.(cluster);
    },
    [onHeroClusterSelect]
  );

  const handleEmbedReady = useCallback(() => {
    if (isHero) {
      onHeroReady?.();
      return;
    }
    globeRef.current?.focusCluster?.(nearestCluster);
  }, [globeRef, isHero, nearestCluster, onHeroReady]);

  useEffect(() => {
    if (!isHero || focusPrayerId == null) return;

    const cluster = displayClusters.find((item) =>
      item.prayers?.some((prayer) => String(prayer.id) === String(focusPrayerId))
    );
    if (!cluster) return;

    setSelectedCluster(cluster);
    if (heroMap) globeRef.current?.focusCluster?.(cluster);
  }, [displayClusters, focusPrayerId, globeRef, heroMap, isHero, onHeroClusterSelect]);

  useEffect(() => {
    if (!isHero || activeClusterId != null || focusPrayerId != null) return;
    globeRef.current?.clearActiveCluster?.();
  }, [activeClusterId, focusPrayerId, globeRef, isHero]);

  if (isHero) {
    return (
      <div
        className={`global-room-embed global-room-embed--hero${fullscreen ? " is-fullscreen" : ""}`}
        aria-label={title}
      >
        <GlobalPrayerGlobe
          ref={globeRef}
          clusters={displayClusters}
          staticView={!heroMap}
          heroMap={heroMap}
          onSelectCluster={handleSelectCluster}
          onBlankClick={onHeroBlankClick}
          onAutoRotateChange={setAutoRotate}
          onReady={handleEmbedReady}
        />
        <style jsx>{`
          .global-room-embed--hero {
            position: absolute;
            inset: 0;
            overflow: hidden;
            background: #020817;
          }

          .global-room-embed--hero :global(.global-room__canvas) {
            position: absolute;
            inset: auto -28vw -12vh auto;
            width: min(1120px, 92vw);
            height: min(920px, 92vh);
            min-height: 520px;
            opacity: 0.98;
          }

          .global-room-embed--hero.is-fullscreen :global(.global-room__canvas) {
            inset: 0;
            width: 100%;
            height: 100%;
            min-height: 100%;
            max-width: none;
            border-radius: 0;
          }

          .global-room-embed--hero.is-fullscreen :global(.global-room__canvas .cesium-viewer),
          .global-room-embed--hero.is-fullscreen
            :global(.global-room__canvas .cesium-viewer-cesiumWidgetContainer),
          .global-room-embed--hero.is-fullscreen :global(.global-room__canvas .cesium-widget),
          .global-room-embed--hero.is-fullscreen
            :global(.global-room__canvas .cesium-widget canvas) {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
          }

          @media (max-width: 860px) {
            .global-room-embed--hero :global(.global-room__canvas) {
              inset: auto 50% -8vh auto;
              width: 118vw;
              height: 72vh;
              min-height: 420px;
              transform: translateX(50%);
              opacity: 0.72;
            }

            .global-room-embed--hero.is-fullscreen :global(.global-room__canvas) {
              inset: 0;
              width: 100%;
              height: 100%;
              min-height: 100%;
              max-width: none;
              transform: none;
              opacity: 0.82;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <section className="global-room-embed" aria-label={title}>
      <div className="global-room-embed__copy">
        <span>全球禱告室</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <div className="global-room-embed__stats" aria-label="首頁全球禱告室摘要">
          <article>
            <strong>{clusters.length}</strong>
            <small>城市光點</small>
          </article>
          <article>
            <strong>{recent24Count}</strong>
            <small>24 小時新增</small>
          </article>
          <article>
            <strong>
              {clusters.reduce((sum, cluster) => sum + Number(cluster.totalCount || 0), 0)}
            </strong>
            <small>全球代禱</small>
          </article>
        </div>
        <div className="global-room-embed__focus">
          <div>
            <span>{selectedCluster?.fullLabel || nearestCluster.fullLabel}</span>
            <h3>
              {selectedPrayer
                ? getPrayerTitle(selectedPrayer)
                : selectedCluster?.isDefaultFocus
                  ? "等待第一個城市光點"
                  : "這座城市目前沒有代禱內容"}
            </h3>
            <p>
              {selectedPrayer
                ? getPrayerDescription(selectedPrayer)
                : "得勝者選擇大概城市後，首頁也會同步亮起城市光點。"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleFocusCluster(selectedCluster || nearestCluster)}
          >
            聚焦城市
          </button>
        </div>
        {latestClusters.length ? (
          <div className="global-room-embed__latest" aria-label="首頁最新代禱">
            {latestClusters.map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                className={selectedCluster?.id === cluster.id ? "is-selected" : ""}
                onClick={() => handleFocusCluster(cluster)}
              >
                <span>{cluster.fullLabel}</span>
                <strong>{getPrayerTitle(cluster.prayers[0])}</strong>
                <small>
                  {formatRelativeTime(cluster.latestCreatedAt)} · {cluster.totalCount} 筆
                </small>
              </button>
            ))}
          </div>
        ) : null}
        <Link href={ctaHref} className="global-room-embed__link" prefetch={false}>
          {ctaLabel}
        </Link>
      </div>
      <div className="global-room-embed__globe">
        <GlobalPrayerGlobe
          ref={globeRef}
          clusters={displayClusters}
          onSelectCluster={handleSelectCluster}
          onAutoRotateChange={setAutoRotate}
          onReady={handleEmbedReady}
        />
        {clusters.length ? (
          <div className="global-room-embed__city-strip" aria-label="首頁快速定位城市">
            {clusters.slice(0, 6).map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                className={selectedCluster?.id === cluster.id ? "is-selected" : ""}
                onClick={() => handleFocusCluster(cluster)}
              >
                {cluster.cityLabel}
                <b>{cluster.totalCount}</b>
              </button>
            ))}
          </div>
        ) : null}
        <div className="global-room-embed__controls" aria-label="首頁地球控制">
          <button type="button" onClick={() => globeRef.current?.zoomIn?.()} aria-label="放大">
            +
          </button>
          <button type="button" onClick={() => globeRef.current?.zoomOut?.()} aria-label="縮小">
            -
          </button>
          <button type="button" onClick={() => globeRef.current?.resetTaipei?.()}>
            台北
          </button>
          <button
            type="button"
            className={autoRotate ? "is-active" : ""}
            onClick={() => {
              const next = !autoRotate;
              setAutoRotate(next);
              globeRef.current?.setAutoRotate?.(next);
            }}
          >
            自轉
          </button>
        </div>
      </div>

      <style jsx>{`
        .global-room-embed {
          display: grid;
          grid-template-columns: minmax(240px, 0.78fr) minmax(0, 1.22fr);
          gap: clamp(1rem, 3vw, 2rem);
          align-items: center;
          padding: clamp(1.2rem, 3vw, 2rem);
          border: 1px solid rgba(125, 211, 252, 0.18);
          border-radius: 8px;
          background:
            radial-gradient(circle at 72% 44%, rgba(56, 189, 248, 0.22), transparent 36%),
            linear-gradient(135deg, #061525, #08203a 58%, #03111f);
          color: #f8fbff;
          overflow: hidden;
        }

        .global-room-embed__copy {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
        }

        .global-room-embed__copy span {
          color: #7dd3fc;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .global-room-embed__copy h2,
        .global-room-embed__copy p {
          margin: 0;
        }

        .global-room-embed__copy h2 {
          color: #ffffff;
          font-size: clamp(1.8rem, 4vw, 3.1rem);
          line-height: 1.08;
        }

        .global-room-embed__copy p {
          color: rgba(226, 232, 240, 0.82);
          line-height: 1.75;
        }

        .global-room-embed__stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .global-room-embed__stats article {
          display: grid;
          gap: 0.18rem;
          border: 1px solid rgba(125, 211, 252, 0.2);
          border-radius: 8px;
          background:
            radial-gradient(circle at 50% 0%, rgba(125, 211, 252, 0.12), transparent 58%),
            rgba(2, 6, 23, 0.32);
          padding: 0.68rem 0.5rem;
          text-align: center;
        }

        .global-room-embed__stats strong {
          color: #fef08a;
          font-size: 1.45rem;
          line-height: 1;
        }

        .global-room-embed__stats small {
          color: rgba(226, 232, 240, 0.72);
          font-size: 0.72rem;
          font-weight: 800;
        }

        .global-room-embed__focus {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.85rem;
          align-items: end;
          border: 1px solid rgba(254, 240, 138, 0.22);
          border-radius: 8px;
          background:
            radial-gradient(circle at 12% 0%, rgba(250, 204, 21, 0.18), transparent 36%),
            rgba(2, 6, 23, 0.36);
          padding: 0.85rem;
        }

        .global-room-embed__focus span {
          color: #7dd3fc;
          font-size: 0.76rem;
          font-weight: 900;
        }

        .global-room-embed__focus h3,
        .global-room-embed__focus p {
          margin: 0;
        }

        .global-room-embed__focus h3 {
          margin-top: 0.2rem;
          color: #ffffff;
          font-size: 1rem;
          line-height: 1.35;
        }

        .global-room-embed__focus p {
          display: -webkit-box;
          margin-top: 0.34rem;
          overflow: hidden;
          color: rgba(226, 232, 240, 0.76);
          line-height: 1.5;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .global-room-embed__focus button {
          min-height: 38px;
          border: 1px solid rgba(254, 240, 138, 0.34);
          border-radius: 8px;
          background: rgba(250, 204, 21, 0.12);
          color: #fef08a;
          font-weight: 900;
          padding: 0.42rem 0.68rem;
          cursor: pointer;
        }

        .global-room-embed__latest {
          display: grid;
          gap: 0.5rem;
        }

        .global-room-embed__latest button {
          display: grid;
          gap: 0.18rem;
          width: 100%;
          border: 1px solid rgba(125, 211, 252, 0.18);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.44), rgba(2, 6, 23, 0.26));
          color: #eef8ff;
          padding: 0.62rem 0.7rem;
          text-align: left;
          cursor: pointer;
        }

        .global-room-embed__latest button:hover,
        .global-room-embed__latest button.is-selected {
          border-color: rgba(254, 240, 138, 0.48);
          background: rgba(250, 204, 21, 0.1);
        }

        .global-room-embed__latest span {
          color: #7dd3fc;
          font-size: 0.74rem;
          font-weight: 900;
        }

        .global-room-embed__latest strong {
          overflow: hidden;
          color: #ffffff;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .global-room-embed__latest small {
          color: rgba(226, 232, 240, 0.68);
        }

        .global-room-embed__link {
          justify-self: start;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          border-radius: 8px;
          background: #38bdf8;
          color: #031525;
          font-weight: 900;
          padding: 0.65rem 0.95rem;
          text-decoration: none;
        }

        .global-room-embed__globe {
          position: relative;
          min-height: 360px;
        }

        .global-room-embed__globe :global(.global-room__canvas) {
          width: 100%;
          height: clamp(360px, 48vw, 540px);
          min-height: 360px;
        }

        .global-room-embed__city-strip {
          position: absolute;
          left: 50%;
          bottom: 4.1rem;
          z-index: 5;
          display: flex;
          width: min(520px, calc(100% - 1.5rem));
          gap: 0.42rem;
          transform: translateX(-50%);
          overflow-x: auto;
          padding: 0.1rem;
          scrollbar-width: none;
        }

        .global-room-embed__city-strip::-webkit-scrollbar {
          display: none;
        }

        .global-room-embed__city-strip button {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
          min-height: 34px;
          border: 1px solid rgba(125, 211, 252, 0.26);
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.58);
          color: #e0f2fe;
          padding: 0.3rem 0.56rem;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(12px);
        }

        .global-room-embed__city-strip button:hover,
        .global-room-embed__city-strip button.is-selected {
          border-color: rgba(254, 240, 138, 0.56);
          color: #fef08a;
          background: rgba(250, 204, 21, 0.12);
        }

        .global-room-embed__city-strip b {
          min-width: 1.25rem;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.16);
          padding: 0.04rem 0.26rem;
          color: #ffffff;
          text-align: center;
          font-size: 0.76rem;
        }

        .global-room-embed__controls {
          position: absolute;
          right: 0.75rem;
          bottom: 0.75rem;
          z-index: 5;
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          justify-content: flex-end;
        }

        .global-room-embed__controls button {
          min-height: 36px;
          border: 1px solid rgba(125, 211, 252, 0.3);
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.58);
          color: #e2f6ff;
          font-weight: 900;
          padding: 0.38rem 0.62rem;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }

        .global-room-embed__controls button:hover,
        .global-room-embed__controls button.is-active {
          border-color: rgba(254, 240, 138, 0.56);
          color: #fef08a;
        }

        @media (max-width: 860px) {
          .global-room-embed {
            grid-template-columns: 1fr;
          }

          .global-room-embed__focus {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <style jsx global>{`
        .global-room__canvas canvas.global-room__webgl {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          min-width: 100% !important;
          object-fit: contain !important;
          touch-action: none !important;
        }
      `}</style>
    </section>
  );
}

export default function GlobalPrayerRoom({ prayers = [] }) {
  const globeRef = useRef(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [modalCluster, setModalCluster] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const {
    clusters,
    displayClusters,
    latestClusters,
    recent24Count,
    unansweredCount,
    nearestCluster,
    taipeiCluster,
  } = usePrayerClusters(prayers);
  const cityList = clusters.slice(0, 8);
  const featuredCities = clusters.slice(0, 6);
  const totalPrayerCount = clusters.reduce(
    (sum, cluster) => sum + Number(cluster.totalCount || 0),
    0
  );
  const totalPrivateCount = clusters.reduce(
    (sum, cluster) => sum + Number(cluster.privateCount || 0),
    0
  );

  useEffect(() => {
    setSelectedCluster((current) => current || nearestCluster);
  }, [nearestCluster]);

  const handleFocusCluster = useCallback((cluster) => {
    setSelectedCluster(cluster);
    globeRef.current?.focusCluster?.(cluster);
  }, []);

  const handleSelectCluster = useCallback((cluster) => {
    setSelectedCluster(cluster);
    setModalCluster(cluster);
  }, []);

  const handleAutoRotateToggle = () => {
    const next = !autoRotate;
    setAutoRotate(next);
    globeRef.current?.setAutoRotate?.(next);
  };

  const selectedPrayer = selectedCluster?.prayers?.[0] || null;
  const selectedVisibility = getClusterVisibility(selectedCluster);
  const selectedToneLabel = getClusterToneLabel(selectedCluster);

  return (
    <section className="global-room" aria-labelledby="global-room-title">
      <div className="global-room__layout">
        <div className="global-room__left">
          <div className="global-room__intro">
            <p className="global-room__eyebrow">全球禱告室</p>
            <h1 id="global-room-title">全球禱告室</h1>
            <p>
              在真實地球上看見各城市正在被守望的代禱。拖曳旋轉、滾輪縮放，點擊城市光點查看公開內容。
            </p>
            <div className="global-room__intro-badges" aria-label="地圖使用說明">
              <span>真實地球地圖</span>
              <span>大致位置</span>
              <span>不顯示 GPS</span>
            </div>
          </div>

          <div className="global-room__globe-shell">
            <div className="global-room__statusbar">
              <span>{autoRotate ? "自動巡航中" : "手動探索中"}</span>
              <strong>{selectedCluster?.fullLabel || nearestCluster.fullLabel}</strong>
            </div>
            <div className="global-room__guide" aria-hidden="true">
              <span>拖曳地球</span>
              <span>縮放靠近</span>
              <span>點光點</span>
            </div>
            <div className="global-room__legend" aria-label="光點說明">
              <span>
                <i className="is-gold" />
                最新 / 尚無回應
              </span>
              <span>
                <i className="is-blue" />
                公開代禱
              </span>
              <span>
                <i className="is-private" />
                匿名守望
              </span>
            </div>
            <GlobalPrayerGlobe
              ref={globeRef}
              clusters={displayClusters}
              onSelectCluster={handleSelectCluster}
              onAutoRotateChange={setAutoRotate}
              onReady={() => globeRef.current?.focusCluster?.(nearestCluster)}
            />
            <div className="global-room__controls" aria-label="地球控制">
              <button type="button" onClick={() => globeRef.current?.zoomIn?.()} aria-label="放大">
                +
              </button>
              <button type="button" onClick={() => globeRef.current?.zoomOut?.()} aria-label="縮小">
                -
              </button>
              <button
                type="button"
                onClick={() => {
                  handleFocusCluster(nearestCluster);
                }}
              >
                最近
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCluster(taipeiCluster);
                  globeRef.current?.focusCluster?.(taipeiCluster);
                }}
              >
                回到台北
              </button>
              <button
                type="button"
                className={autoRotate ? "is-active" : ""}
                onClick={handleAutoRotateToggle}
              >
                自動旋轉
              </button>
            </div>
            {featuredCities.length ? (
              <div className="global-room__city-strip" aria-label="快速定位城市">
                {featuredCities.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    className={selectedCluster?.id === cluster.id ? "is-selected" : ""}
                    onClick={() => handleFocusCluster(cluster)}
                  >
                    <span>{cluster.cityLabel}</span>
                    <b>{cluster.totalCount}</b>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="global-room__map-note">Cesium globe · OpenStreetMap city tiles</div>
          </div>
        </div>

        <aside className="global-room__panel" aria-label="全球禱告室摘要">
          <div className="global-room__panel-title">
            <span>Live Overview</span>
            <h2>城市守望總覽</h2>
          </div>
          <div className="global-room__stats">
            <article>
              <strong>{totalPrayerCount}</strong>
              <span>全球代禱</span>
            </article>
            <article>
              <strong>{clusters.length}</strong>
              <span>城市光點</span>
            </article>
            <article>
              <strong>{recent24Count}</strong>
              <span>24 小時內</span>
            </article>
            <article>
              <strong>{totalPrivateCount}</strong>
              <span>匿名守望</span>
            </article>
          </div>
          <div className="global-room__priority-banner">
            <span>Needs response</span>
            <strong>{unansweredCount} 筆代禱尚無回應</strong>
          </div>

          <section
            className={`global-room__selected is-${selectedVisibility}`}
            aria-label="目前選取代禱"
          >
            <div className="global-room__selected-kicker">
              <span>目前焦點</span>
              <b>{selectedToneLabel}</b>
            </div>
            <span>{selectedCluster?.fullLabel || "台北, 台灣"}</span>
            <h2>
              {selectedPrayer
                ? getPrayerTitle(selectedPrayer)
                : selectedCluster?.isDefaultFocus
                  ? "等待第一個城市光點"
                  : "這個城市目前沒有代禱內容"}
            </h2>
            <p>
              {selectedPrayer
                ? getPrayerDescription(selectedPrayer)
                : "得勝者建立代禱事項並選擇大概城市後，光點會在地球上亮起。"}
            </p>
            <div className="global-room__selected-meta">
              <span>{selectedCluster?.totalCount ?? 0} 筆代禱</span>
              {selectedCluster?.privateCount ? (
                <span>{selectedCluster.privateCount} 筆不公開</span>
              ) : null}
              <span>{selectedCluster?.unansweredCount ?? 0} 筆尚無回應</span>
              <span>{formatRelativeTime(selectedCluster?.latestCreatedAt)}</span>
            </div>
            {selectedCluster && !selectedCluster.isDefaultFocus ? (
              <button
                type="button"
                className="global-room__secondary-action"
                onClick={() => setModalCluster(selectedCluster)}
              >
                查看這座城市全部代禱
              </button>
            ) : null}
          </section>

          <section className="global-room__attention" aria-label="最新需要關注">
            <div className="global-room__panel-head">
              <h2>最新需要關注</h2>
              <span>點一下，地球會旋轉到該城市</span>
            </div>
            {latestClusters.length ? (
              <div className="global-room__attention-list">
                {latestClusters.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    className={`global-room__attention-item is-${getClusterVisibility(cluster)}${
                      selectedCluster?.id === cluster.id ? " is-selected" : ""
                    }`}
                    onClick={() => handleFocusCluster(cluster)}
                  >
                    <span>
                      {cluster.fullLabel}
                      <b>{getClusterToneLabel(cluster)}</b>
                    </span>
                    <strong>{getPrayerTitle(cluster.prayers[0])}</strong>
                    <small>
                      {formatRelativeTime(cluster.latestCreatedAt)} · {cluster.totalCount} 筆代禱
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="global-room__empty">
                目前還沒有選擇城市的代禱事項。地球預設停在台北，等待第一個光點被點亮。
              </p>
            )}
          </section>

          {cityList.length ? (
            <section className="global-room__cities" aria-label="城市光點列表">
              <div className="global-room__panel-head">
                <h2>城市光點</h2>
                <span>不用旋轉也能快速定位</span>
              </div>
              <div className="global-room__city-list">
                {cityList.map((cluster) => (
                  <button
                    key={cluster.id}
                    type="button"
                    className={`global-room__city-item is-${getClusterVisibility(cluster)}${
                      selectedCluster?.id === cluster.id ? " is-selected" : ""
                    }`}
                    onClick={() => handleFocusCluster(cluster)}
                  >
                    <span>{cluster.cityLabel}</span>
                    <strong>{cluster.totalCount}</strong>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <Link href="/customer-portal/create" className="global-room__cta" prefetch={false}>
            新增代禱
          </Link>
        </aside>
      </div>

      {modalCluster ? (
        <div
          className="global-room__modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-prayer-modal-title"
        >
          <button
            type="button"
            className="global-room__backdrop"
            onClick={() => setModalCluster(null)}
            aria-label="關閉彈窗"
          />
          <article className="global-room__dialog">
            <button
              type="button"
              className="global-room__close"
              onClick={() => setModalCluster(null)}
            >
              關閉
            </button>
            <span>{modalCluster.fullLabel}</span>
            <h2 id="global-prayer-modal-title">
              {modalCluster.isDefaultFocus
                ? "台北預設視角"
                : `${modalCluster.cityLabel} 的代禱事項`}
            </h2>
            {modalCluster.isDefaultFocus ? (
              <p>
                目前沒有任何城市代禱光點。得勝者建立代禱事項並選擇大概城市後，光點會出現在這裡。
              </p>
            ) : (
              <>
                <div className="global-room__dialog-meta">
                  <span>{modalCluster.totalCount} 筆代禱</span>
                  {modalCluster.privateCount ? (
                    <span>{modalCluster.privateCount} 筆匿名守望</span>
                  ) : null}
                  <span>{modalCluster.unansweredCount} 筆尚無回應</span>
                  <span>最新：{formatRelativeTime(modalCluster.latestCreatedAt)}</span>
                </div>
                <div className="global-room__prayer-list">
                  {modalCluster.prayers.map((prayer) => (
                    <article
                      key={prayer.id}
                      className={`global-room__prayer-item${prayer.isPrivate ? " is-private" : ""}`}
                    >
                      <div>
                        <strong>{getPrayerTitle(prayer)}</strong>
                        <p>{getPrayerDescription(prayer)}</p>
                        <small>
                          {formatRelativeTime(prayer.createdAt)}
                          {prayer.isPrivate
                            ? " · 不公開內容"
                            : ` · ${prayer.responseCount ?? 0} 個回應${
                                prayer.owner?.name ? ` · 得勝者：${prayer.owner.name}` : ""
                              }`}
                        </small>
                      </div>
                      {prayer.isPrivate ? (
                        <span className="global-room__private-pill">匿名光點</span>
                      ) : (
                        <Link
                          href={`/prayfor/${prayer.id}`}
                          className="global-room__detail-link"
                          prefetch={false}
                        >
                          進入
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </article>
        </div>
      ) : null}

      <style jsx>{`
        .global-room {
          min-height: calc(100vh - 78px);
          padding: clamp(1rem, 3vw, 2rem);
          color: #f8fbff;
          background:
            linear-gradient(rgba(125, 211, 252, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.035) 1px, transparent 1px),
            radial-gradient(circle at 48% 28%, rgba(56, 189, 248, 0.28), transparent 33%),
            radial-gradient(circle at 84% 18%, rgba(250, 204, 21, 0.14), transparent 26%),
            linear-gradient(145deg, #061525 0%, #0b2140 52%, #06111f 100%);
          background-size:
            42px 42px,
            42px 42px,
            auto,
            auto,
            auto;
          overflow: hidden;
        }

        .global-room__layout {
          width: min(1360px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(310px, 360px);
          gap: clamp(1rem, 2.6vw, 2rem);
          align-items: stretch;
        }

        .global-room__left {
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 0.9rem;
        }

        .global-room__intro {
          text-align: center;
        }

        .global-room__eyebrow {
          margin: 0 0 0.45rem;
          color: #7dd3fc;
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .global-room__intro h1 {
          margin: 0;
          color: #ffffff;
          font-size: clamp(2.2rem, 5vw, 4.25rem);
          line-height: 1;
          text-shadow: 0 12px 30px rgba(2, 6, 23, 0.5);
        }

        .global-room__intro p:not(.global-room__eyebrow) {
          max-width: 760px;
          margin: 0.75rem auto 0;
          color: rgba(226, 232, 240, 0.88);
          line-height: 1.75;
        }

        .global-room__intro-badges {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.9rem;
        }

        .global-room__intro-badges span {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          border: 1px solid rgba(125, 211, 252, 0.24);
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.34);
          color: rgba(226, 232, 240, 0.86);
          padding: 0.26rem 0.7rem;
          font-size: 0.78rem;
          font-weight: 900;
          backdrop-filter: blur(10px);
        }

        .global-room__globe-shell {
          position: relative;
          display: grid;
          place-items: center;
          min-height: clamp(520px, 66vw, 760px);
          border: 1px solid rgba(125, 211, 252, 0.18);
          border-radius: 8px;
          background:
            radial-gradient(circle at 50% 46%, rgba(56, 189, 248, 0.24), transparent 48%),
            radial-gradient(circle at 50% 58%, rgba(250, 204, 21, 0.11), transparent 24%),
            radial-gradient(circle at 12% 14%, rgba(167, 243, 208, 0.1), transparent 28%),
            linear-gradient(180deg, rgba(8, 25, 47, 0.76), rgba(2, 8, 23, 0.46));
          overflow: hidden;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 24px 70px rgba(2, 8, 23, 0.28);
        }

        .global-room__globe-shell::before {
          position: absolute;
          inset: 10% 16%;
          content: "";
          border-radius: 50%;
          background:
            radial-gradient(circle, rgba(250, 204, 21, 0.14), transparent 18%),
            radial-gradient(circle, rgba(56, 189, 248, 0.28), transparent 68%);
          filter: blur(28px);
          pointer-events: none;
        }

        .global-room__globe-shell::after {
          position: absolute;
          inset: 1px;
          content: "";
          border-radius: inherit;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.06),
            transparent 24%,
            rgba(2, 6, 23, 0.12)
          );
          pointer-events: none;
        }

        .global-room__statusbar {
          position: absolute;
          top: 0.8rem;
          left: 50%;
          z-index: 4;
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          transform: translateX(-50%);
          border: 1px solid rgba(125, 211, 252, 0.3);
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.56);
          color: rgba(226, 232, 240, 0.92);
          padding: 0.42rem 0.72rem;
          font-size: 0.82rem;
          font-weight: 800;
          white-space: nowrap;
          backdrop-filter: blur(12px);
        }

        .global-room__statusbar span {
          color: #7dd3fc;
        }

        .global-room__statusbar strong {
          color: #fef08a;
        }

        .global-room__guide {
          position: absolute;
          left: 1rem;
          top: 1rem;
          z-index: 4;
          display: grid;
          gap: 0.45rem;
          pointer-events: none;
        }

        .global-room__guide span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.46);
          color: rgba(226, 232, 240, 0.82);
          padding: 0.26rem 0.62rem;
          font-size: 0.76rem;
          font-weight: 800;
          backdrop-filter: blur(10px);
        }

        .global-room__legend {
          position: absolute;
          left: 1rem;
          bottom: 1rem;
          z-index: 5;
          display: grid;
          gap: 0.42rem;
          max-width: 230px;
          border: 1px solid rgba(125, 211, 252, 0.2);
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.56);
          padding: 0.62rem;
          backdrop-filter: blur(14px);
        }

        .global-room__legend span {
          display: flex;
          align-items: center;
          gap: 0.48rem;
          color: rgba(226, 232, 240, 0.84);
          font-size: 0.76rem;
          font-weight: 800;
          white-space: nowrap;
        }

        .global-room__legend i {
          width: 0.72rem;
          height: 0.72rem;
          border-radius: 999px;
          box-shadow: 0 0 18px currentColor;
        }

        .global-room__legend i.is-gold {
          background: #fef08a;
          color: #fef08a;
        }

        .global-room__legend i.is-blue {
          background: #7dd3fc;
          color: #7dd3fc;
        }

        .global-room__legend i.is-private {
          background: #bfdbfe;
          color: #bfdbfe;
        }

        .global-room__canvas {
          position: relative;
          z-index: 1;
          width: min(820px, 96%);
          height: min(760px, 72vh);
          min-height: 480px;
          cursor: grab;
          touch-action: none;
        }

        .global-room__canvas:active {
          cursor: grabbing;
        }

        .global-room__canvas :global(canvas) {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          outline: none;
          touch-action: none;
        }

        .global-room__loader {
          position: absolute;
          inset: 0;
          z-index: 8;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 0.85rem;
          color: #dff7ff;
          background: radial-gradient(circle, rgba(8, 47, 73, 0.64), rgba(2, 6, 23, 0.1));
          text-align: center;
        }

        .global-room__loader span {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 4px solid rgba(125, 211, 252, 0.2);
          border-top-color: #fef08a;
          animation: global-room-spin 0.9s linear infinite;
        }

        .global-room__loader--error {
          padding: 1rem;
          color: #fecaca;
        }

        .global-room__loader--error small {
          max-width: 360px;
          color: rgba(254, 202, 202, 0.82);
          line-height: 1.5;
        }

        .global-room__labels {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
        }

        .global-room__label {
          position: absolute;
          display: inline-flex;
          align-items: center;
          gap: 0.28rem;
          transform: translate(-50%, calc(-100% - 12px));
          border: 1px solid rgba(125, 211, 252, 0.36);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(8, 25, 47, 0.82), rgba(2, 6, 23, 0.72));
          color: #dff7ff;
          box-shadow:
            0 0 20px rgba(56, 189, 248, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          padding: 0.28rem 0.52rem;
          font-size: 0.78rem;
          font-weight: 900;
          white-space: nowrap;
          backdrop-filter: blur(10px);
        }

        .global-room__label.is-hot {
          border-color: rgba(254, 240, 138, 0.6);
          color: #fef08a;
          box-shadow: 0 0 26px rgba(250, 204, 21, 0.34);
        }

        .global-room__label.is-private {
          border-color: rgba(191, 219, 254, 0.52);
          color: #dbeafe;
          box-shadow:
            0 0 24px rgba(147, 197, 253, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .global-room__label.is-mixed {
          border-color: rgba(167, 243, 208, 0.5);
          color: #d1fae5;
          box-shadow:
            0 0 24px rgba(52, 211, 153, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .global-room__label b {
          min-width: 1.25rem;
          border-radius: 999px;
          background: rgba(250, 204, 21, 0.22);
          padding: 0.06rem 0.28rem;
          text-align: center;
        }

        .global-room__controls {
          position: absolute;
          right: 1rem;
          bottom: 1rem;
          z-index: 5;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.5rem;
          max-width: min(460px, 92%);
        }

        .global-room__city-strip {
          position: absolute;
          left: 50%;
          bottom: 5rem;
          z-index: 5;
          display: flex;
          width: min(620px, calc(100% - 2rem));
          gap: 0.45rem;
          transform: translateX(-50%);
          overflow-x: auto;
          padding: 0.15rem;
          scrollbar-width: none;
        }

        .global-room__city-strip::-webkit-scrollbar {
          display: none;
        }

        .global-room__city-strip button {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 0.42rem;
          min-height: 38px;
          border: 1px solid rgba(125, 211, 252, 0.26);
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.58);
          color: #e0f2fe;
          padding: 0.36rem 0.62rem;
          font-weight: 900;
          cursor: pointer;
          backdrop-filter: blur(12px);
        }

        .global-room__city-strip button:hover,
        .global-room__city-strip button.is-selected {
          border-color: rgba(254, 240, 138, 0.56);
          color: #fef08a;
          background: rgba(250, 204, 21, 0.12);
        }

        .global-room__city-strip b {
          min-width: 1.35rem;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.16);
          padding: 0.06rem 0.3rem;
          color: #ffffff;
          text-align: center;
        }

        .global-room__map-note {
          position: absolute;
          right: 1rem;
          top: 1rem;
          z-index: 4;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.42);
          color: rgba(203, 213, 225, 0.72);
          padding: 0.26rem 0.56rem;
          font-size: 0.68rem;
          font-weight: 800;
          backdrop-filter: blur(10px);
        }

        .global-room__controls button,
        .global-room__secondary-action {
          min-height: 40px;
          border: 1px solid rgba(125, 211, 252, 0.32);
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.64);
          color: #e2f6ff;
          font-weight: 900;
          padding: 0.48rem 0.74rem;
          cursor: pointer;
          backdrop-filter: blur(10px);
        }

        .global-room__controls button:hover,
        .global-room__controls button.is-active,
        .global-room__secondary-action:hover {
          border-color: rgba(254, 240, 138, 0.62);
          color: #fef08a;
        }

        .global-room__panel {
          display: grid;
          align-content: start;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid rgba(125, 211, 252, 0.26);
          border-radius: 8px;
          background:
            linear-gradient(180deg, rgba(8, 25, 47, 0.72), rgba(2, 8, 23, 0.54)),
            rgba(2, 6, 23, 0.44);
          backdrop-filter: blur(14px);
          box-shadow:
            0 28px 70px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .global-room__panel-title {
          display: grid;
          gap: 0.2rem;
          padding: 0.12rem 0.1rem;
        }

        .global-room__panel-title span {
          color: #7dd3fc;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .global-room__panel-title h2 {
          margin: 0;
          color: #ffffff;
          font-size: 1.2rem;
          line-height: 1.2;
        }

        .global-room__stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .global-room__stats article,
        .global-room__selected,
        .global-room__attention,
        .global-room__cities {
          border: 1px solid rgba(125, 211, 252, 0.18);
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.3);
        }

        .global-room__stats article {
          display: grid;
          gap: 0.2rem;
          padding: 0.74rem 0.5rem;
          text-align: center;
          background:
            radial-gradient(circle at 50% 0%, rgba(125, 211, 252, 0.12), transparent 58%),
            rgba(2, 6, 23, 0.3);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 12px 32px rgba(2, 6, 23, 0.18);
        }

        .global-room__stats strong {
          color: #fef08a;
          font-size: 1.55rem;
          line-height: 1;
        }

        .global-room__stats span,
        .global-room__selected-meta span,
        .global-room__panel-head span,
        .global-room__attention-item span,
        .global-room__attention-item small,
        .global-room__empty {
          color: rgba(226, 232, 240, 0.72);
        }

        .global-room__priority-banner {
          display: grid;
          gap: 0.18rem;
          border: 1px solid rgba(254, 240, 138, 0.22);
          border-radius: 8px;
          background:
            radial-gradient(circle at 12% 10%, rgba(250, 204, 21, 0.2), transparent 38%),
            rgba(69, 26, 3, 0.22);
          padding: 0.75rem 0.85rem;
          box-shadow: 0 16px 42px rgba(2, 6, 23, 0.18);
        }

        .global-room__priority-banner span {
          color: #fef08a;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .global-room__priority-banner strong {
          color: #ffffff;
          font-size: 0.95rem;
          line-height: 1.35;
        }

        .global-room__selected,
        .global-room__attention,
        .global-room__cities {
          display: grid;
          gap: 0.72rem;
          padding: 0.9rem;
        }

        .global-room__selected {
          position: relative;
          overflow: hidden;
        }

        .global-room__selected::before {
          position: absolute;
          inset: 0;
          content: "";
          background:
            linear-gradient(90deg, rgba(250, 204, 21, 0.12), transparent 42%),
            radial-gradient(circle at 12% 18%, rgba(250, 204, 21, 0.18), transparent 24%);
          pointer-events: none;
        }

        .global-room__selected.is-private::before {
          background:
            linear-gradient(90deg, rgba(147, 197, 253, 0.14), transparent 44%),
            radial-gradient(circle at 12% 18%, rgba(191, 219, 254, 0.2), transparent 24%);
        }

        .global-room__selected.is-mixed::before {
          background:
            linear-gradient(90deg, rgba(52, 211, 153, 0.13), transparent 44%),
            radial-gradient(circle at 12% 18%, rgba(167, 243, 208, 0.18), transparent 24%);
        }

        .global-room__selected > * {
          position: relative;
        }

        .global-room__selected-kicker {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .global-room__selected-kicker span {
          color: rgba(226, 232, 240, 0.66);
          font-size: 0.76rem;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .global-room__selected-kicker b {
          border-radius: 999px;
          background: rgba(250, 204, 21, 0.17);
          color: #fef08a;
          border: 1px solid rgba(250, 204, 21, 0.22);
          padding: 0.16rem 0.5rem;
          font-size: 0.72rem;
        }

        .global-room__selected.is-private .global-room__selected-kicker b {
          background: rgba(147, 197, 253, 0.16);
          border-color: rgba(147, 197, 253, 0.28);
          color: #dbeafe;
        }

        .global-room__selected.is-mixed .global-room__selected-kicker b {
          background: rgba(52, 211, 153, 0.14);
          border-color: rgba(52, 211, 153, 0.26);
          color: #d1fae5;
        }

        .global-room__selected > span {
          color: #7dd3fc;
          font-size: 0.82rem;
          font-weight: 900;
        }

        .global-room__selected h2,
        .global-room__selected p,
        .global-room__panel-head h2 {
          margin: 0;
        }

        .global-room__selected h2 {
          color: #ffffff;
          font-size: 1.16rem;
          line-height: 1.35;
          text-wrap: balance;
        }

        .global-room__selected p {
          display: -webkit-box;
          color: rgba(226, 232, 240, 0.82);
          line-height: 1.65;
          overflow: hidden;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
        }

        .global-room__selected-meta,
        .global-room__dialog-meta {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .global-room__selected-meta span,
        .global-room__dialog-meta span {
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.28);
          padding: 0.25rem 0.58rem;
          font-size: 0.78rem;
        }

        .global-room__panel-head {
          display: grid;
          gap: 0.25rem;
        }

        .global-room__panel-head h2 {
          color: #ffffff;
          font-size: 1rem;
        }

        .global-room__attention-list {
          display: grid;
          gap: 0.55rem;
        }

        .global-room__attention-item {
          display: grid;
          gap: 0.24rem;
          width: 100%;
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.48), rgba(2, 6, 23, 0.34));
          color: #eef8ff;
          padding: 0.68rem;
          text-align: left;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .global-room__attention-item:hover {
          border-color: rgba(254, 240, 138, 0.5);
          background: rgba(14, 165, 233, 0.14);
        }

        .global-room__attention-item.is-selected,
        .global-room__city-item.is-selected {
          border-color: rgba(254, 240, 138, 0.62);
          background: rgba(250, 204, 21, 0.1);
          box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.16) inset;
        }

        .global-room__attention-item.is-private,
        .global-room__city-item.is-private {
          border-color: rgba(147, 197, 253, 0.26);
          background: linear-gradient(180deg, rgba(30, 64, 175, 0.18), rgba(2, 6, 23, 0.32));
        }

        .global-room__attention-item.is-private.is-selected,
        .global-room__city-item.is-private.is-selected {
          border-color: rgba(191, 219, 254, 0.58);
          background: rgba(59, 130, 246, 0.14);
          box-shadow: 0 0 0 1px rgba(147, 197, 253, 0.18) inset;
        }

        .global-room__attention-item.is-mixed,
        .global-room__city-item.is-mixed {
          border-color: rgba(52, 211, 153, 0.24);
          background: linear-gradient(180deg, rgba(6, 78, 59, 0.18), rgba(2, 6, 23, 0.32));
        }

        .global-room__attention-item.is-mixed.is-selected,
        .global-room__city-item.is-mixed.is-selected {
          border-color: rgba(167, 243, 208, 0.5);
          background: rgba(16, 185, 129, 0.12);
          box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.16) inset;
        }

        .global-room__attention-item span {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .global-room__attention-item span b {
          border-radius: 999px;
          background: rgba(250, 204, 21, 0.16);
          color: #fef08a;
          border: 1px solid rgba(250, 204, 21, 0.22);
          padding: 0.1rem 0.42rem;
          font-size: 0.68rem;
        }

        .global-room__attention-item.is-private span b {
          background: rgba(147, 197, 253, 0.16);
          border-color: rgba(147, 197, 253, 0.28);
          color: #dbeafe;
        }

        .global-room__attention-item.is-mixed span b {
          background: rgba(52, 211, 153, 0.14);
          border-color: rgba(52, 211, 153, 0.26);
          color: #d1fae5;
        }

        .global-room__attention-item strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .global-room__city-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .global-room__city-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          min-height: 42px;
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.48), rgba(2, 6, 23, 0.34));
          color: #eef8ff;
          padding: 0.48rem 0.58rem;
          cursor: pointer;
        }

        .global-room__city-item:hover {
          border-color: rgba(125, 211, 252, 0.42);
          background: rgba(14, 165, 233, 0.12);
        }

        .global-room__city-item span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 800;
        }

        .global-room__city-item strong {
          min-width: 1.7rem;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.14);
          color: #bae6fd;
          padding: 0.12rem 0.38rem;
          text-align: center;
          font-size: 0.8rem;
        }

        .global-room__city-item.is-private strong {
          background: rgba(147, 197, 253, 0.16);
          color: #dbeafe;
        }

        .global-room__city-item.is-mixed strong {
          background: rgba(52, 211, 153, 0.14);
          color: #d1fae5;
        }

        .global-room__cta,
        .global-room__detail-link,
        .global-room__private-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0.65rem 0.9rem;
          border-radius: 8px;
          background: #38bdf8;
          color: #031525;
          font-weight: 900;
          text-decoration: none;
        }

        .global-room__private-pill {
          background: linear-gradient(180deg, rgba(147, 197, 253, 0.18), rgba(30, 64, 175, 0.1));
          color: #dbeafe;
          border: 1px solid rgba(147, 197, 253, 0.34);
        }

        .global-room__modal {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 1rem;
        }

        .global-room__backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background:
            radial-gradient(circle at 50% 35%, rgba(56, 189, 248, 0.12), transparent 38%),
            rgba(2, 6, 23, 0.78);
          backdrop-filter: blur(6px);
        }

        .global-room__dialog {
          position: relative;
          width: min(680px, 100%);
          max-height: min(760px, 86vh);
          display: grid;
          gap: 0.85rem;
          overflow: auto;
          padding: clamp(1.1rem, 3vw, 1.8rem);
          border: 1px solid rgba(125, 211, 252, 0.34);
          border-radius: 8px;
          background:
            radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.16), transparent 34%),
            linear-gradient(180deg, #081d34, #061426);
          box-shadow:
            0 28px 70px rgba(0, 0, 0, 0.46),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .global-room__dialog h2,
        .global-room__dialog p {
          margin: 0;
        }

        .global-room__dialog > span {
          color: #7dd3fc;
          font-size: 0.88rem;
          font-weight: 900;
        }

        .global-room__close {
          justify-self: end;
          min-height: 36px;
          border: 1px solid rgba(148, 163, 184, 0.36);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.72);
          color: #e2e8f0;
          padding: 0 0.75rem;
          cursor: pointer;
        }

        .global-room__prayer-list {
          display: grid;
          gap: 0.65rem;
        }

        .global-room__prayer-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.75rem;
          align-items: center;
          border: 1px solid rgba(125, 211, 252, 0.18);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.44), rgba(2, 6, 23, 0.3));
          padding: 0.75rem;
        }

        .global-room__prayer-item.is-private {
          border-color: rgba(147, 197, 253, 0.28);
          background: linear-gradient(180deg, rgba(30, 64, 175, 0.16), rgba(2, 6, 23, 0.3));
        }

        .global-room__prayer-item strong,
        .global-room__prayer-item p {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .global-room__prayer-item.is-private strong {
          color: #dbeafe;
        }

        .global-room__prayer-item p,
        .global-room__prayer-item small {
          color: rgba(226, 232, 240, 0.74);
        }

        @keyframes global-room-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 980px) {
          .global-room__layout {
            grid-template-columns: 1fr;
          }

          .global-room__panel {
            width: min(720px, 100%);
            margin: 0 auto;
          }
        }

        @media (max-width: 640px) {
          .global-room {
            padding: 0.8rem;
          }

          .global-room__intro p:not(.global-room__eyebrow) {
            font-size: 0.92rem;
          }

          .global-room__globe-shell {
            min-height: clamp(430px, 116vw, 590px);
          }

          .global-room__canvas {
            width: min(680px, 100%);
            height: min(650px, 70vh);
            min-height: 410px;
          }

          .global-room__statusbar {
            top: 0.55rem;
            max-width: calc(100% - 1rem);
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 0.74rem;
          }

          .global-room__guide {
            left: 0.55rem;
            top: 3.2rem;
            gap: 0.32rem;
          }

          .global-room__guide span {
            min-height: 26px;
            padding: 0.18rem 0.46rem;
            font-size: 0.68rem;
          }

          .global-room__controls {
            left: 50%;
            right: auto;
            bottom: 0.55rem;
            transform: translateX(-50%);
            justify-content: center;
            width: min(380px, 96%);
          }

          .global-room__controls button {
            min-height: 36px;
            padding: 0.38rem 0.55rem;
            font-size: 0.8rem;
          }

          .global-room__legend {
            left: 0.55rem;
            right: 0.55rem;
            bottom: 4.4rem;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            max-width: none;
            padding: 0.48rem;
          }

          .global-room__legend span {
            justify-content: center;
            font-size: 0.66rem;
          }

          .global-room__city-strip {
            bottom: 7.2rem;
            width: calc(100% - 1rem);
          }

          .global-room__map-note {
            display: none;
          }

          .global-room__stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .global-room__attention-list {
            grid-auto-flow: column;
            grid-auto-columns: minmax(220px, 1fr);
            overflow-x: auto;
            padding-bottom: 0.25rem;
          }

          .global-room__city-list {
            grid-auto-flow: column;
            grid-auto-columns: minmax(140px, 1fr);
            grid-template-columns: none;
            overflow-x: auto;
            padding-bottom: 0.25rem;
          }

          .global-room__prayer-item {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

export function GlobalPrayerRoomPageExperience({ prayers = [] }) {
  const globeRef = useRef(null);
  const authUser = useAuthSession();
  const { currentTrack, isPlaying, playTrack, setQueue, setIsExpanded } = useAudio();
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [modalCluster, setModalCluster] = useState(null);
  const [hoveredCluster, setHoveredCluster] = useState(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [countrySearchMessage, setCountrySearchMessage] = useState("");
  const activeLayers = useMemo(() => new Set(PRAYER_LAYERS.map((layer) => layer.key)), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerMode, setDrawerMode] = useState("pray");
  const [replyText, setReplyText] = useState("");
  const [replyNotice, setReplyNotice] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [flashClusterId, setFlashClusterId] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const {
    clusters,
    nearestCluster,
    taipeiCluster,
  } = usePrayerClusters(prayers);

  const filteredClusters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return clusters
      .map((cluster) => {
        const prayersForCluster = (cluster.prayers || []).filter((prayer) => {
          const layerMatch =
            activeLayers.has(prayer.categoryKey) ||
            (activeLayers.has("urgent") && prayer.isUrgent) ||
            (activeLayers.has("audio") && getPrayerAudioCount(prayer) > 0);
          if (!layerMatch) return false;
          if (!query) return true;

          return `${getPrayerTitle(prayer)} ${getPrayerDescription(prayer)} ${cluster.fullLabel} ${
            prayer.categoryLabel || ""
          }`
            .toLowerCase()
            .includes(query);
        });

        if (!prayersForCluster.length) return null;

        const heatScore = prayersForCluster.reduce((sum, prayer) => sum + getPrayerHeat(prayer), 0);
        const audioCount = prayersForCluster.reduce(
          (sum, prayer) => sum + getPrayerAudioCount(prayer),
          0
        );
        const replyCount = prayersForCluster.reduce(
          (sum, prayer) => sum + Number(prayer.responseCount || 0),
          0
        );
        const prayerCount = prayersForCluster.reduce(
          (sum, prayer) => sum + Number(prayer.prayerCount || 1),
          0
        );
        const categoryCounts = prayersForCluster.reduce((acc, prayer) => {
          acc[prayer.categoryKey] = Number(acc[prayer.categoryKey] || 0) + 1;
          return acc;
        }, {});
        const primaryCategoryKey =
          Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          cluster.primaryCategoryKey;

        return {
          ...cluster,
          prayers: prayersForCluster,
          totalCount: prayersForCluster.length,
          heatScore,
          audioCount,
          replyCount,
          prayerCount,
          primaryCategoryKey,
          categoryLabel: getCategoryLabel(primaryCategoryKey),
          isUrgent: prayersForCluster.some((prayer) => prayer.isUrgent),
          hasUnanswered: prayersForCluster.some((prayer) => Number(prayer.responseCount || 0) === 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.priority || b.heatScore || 0) - Number(a.priority || a.heatScore || 0));
  }, [activeLayers, clusters, searchQuery]);

  const displayClusters = filteredClusters.length ? filteredClusters : [TAIPEI];

  const totalPrayerCount = filteredClusters.reduce(
    (sum, cluster) => sum + Number(cluster.totalCount || 0),
    0
  );

  useEffect(() => {
    setSelectedCluster((current) => current || taipeiCluster || nearestCluster);
  }, [nearestCluster, taipeiCluster]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowGuide(window.localStorage.getItem("gpr-guide-seen-v1") !== "true");
  }, []);

  const closePopup = useCallback(() => {
    setModalCluster(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") closePopup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePopup]);

  const handleSelectCluster = useCallback((cluster) => {
    if (!cluster) return;
    setSelectedCluster(cluster);
    setModalCluster(cluster);
    globeRef.current?.focusCluster?.(cluster);
  }, []);

  const focusCountry = useCallback((country) => {
    if (!country) return;
    setCountryQuery(country.label);
    setCountrySearchMessage(`${country.localLabel || country.label} 已定位`);
    globeRef.current?.focusCountry?.(country);
  }, []);

  const handleCountrySearch = (event) => {
    event.preventDefault();
    const query = countryQuery.trim();
    setSearchQuery(query);
    if (!query) return;

    const country = findCountryFocus(countryQuery);
    if (country) {
      focusCountry(country);
      return;
    }

    const normalized = query.toLowerCase();
    const matchedCluster = clusters.find((cluster) =>
      `${cluster.fullLabel} ${cluster.locationCity || ""} ${cluster.locationCountry || ""} ${
        cluster.prayers?.map((prayer) => `${getPrayerTitle(prayer)} ${getPrayerDescription(prayer)}`).join(" ") || ""
      }`
        .toLowerCase()
        .includes(normalized)
    );

    if (!matchedCluster) {
      setCountrySearchMessage("找不到相關國家、城市或事件，請試 Taiwan, Japan, USA, Healing");
      return;
    }

    setCountrySearchMessage(`${matchedCluster.fullLabel} 已定位，右側顯示相關代禱`);
    handleSelectCluster(matchedCluster);
  };

  const selectedPrayer = selectedCluster?.prayers?.[0] || null;
  const drawerPrayer = modalCluster?.prayers?.[0] || selectedPrayer;
  const focusListeningActive = Boolean(isPlaying && currentTrack);

  const dismissGuide = useCallback(() => {
    setShowGuide(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gpr-guide-seen-v1", "true");
    }
  }, []);

  const handlePlayAudio = useCallback(async (prayer = drawerPrayer) => {
    if (!prayer) return;
    const queue = [];
    if (prayer.voiceHref) {
      queue.push({
        id: `card-${prayer.id}`,
        voiceUrl: prayer.voiceHref,
        speaker: prayer.owner?.name || prayer.owner?.username || "Prayer Partner",
        message: getPrayerTitle(prayer),
        requestTitle: getPrayerTitle(prayer),
      });
    }

    try {
      const response = await fetch(`/api/responses/${prayer.id}`, { cache: "no-store" });
      if (response.ok) {
        const responses = await response.json();
        responses
          .filter((item) => item?.voiceUrl)
          .forEach((item) => {
            if (queue.some((track) => track.voiceUrl === item.voiceUrl)) return;
            queue.push({
              id: item.id,
              voiceUrl: item.voiceUrl,
              speaker: item.isAnonymous
                ? "Anonymous Prayer"
                : item.responder?.name || item.responder?.username || "Prayer Partner",
              message: item.message || "",
              requestTitle: getPrayerTitle(prayer),
            });
          });
      }

      if (!queue.length) {
        setReplyNotice("目前還沒有可播放的語音禱告。");
        return;
      }

      setQueue(queue, 0);
      playTrack(queue[0]);
      setIsExpanded?.(true);
      setReplyNotice("正在播放這個代禱事項的語音。");
    } catch {
      setReplyNotice("語音暫時無法載入，請稍後再試。");
    }
  }, [drawerPrayer, playTrack, setIsExpanded, setQueue]);

  const submitPrayerResponse = useCallback(
    async ({ message, audioFile }) => {
      if (!drawerPrayer || replySubmitting || audioUploading) return;
      if (!authUser) {
        setReplyNotice("請先登入，才能回覆或上傳語音禱告。");
        return;
      }

      const formData = new FormData();
      formData.append("requestId", String(drawerPrayer.id));
      formData.append("message", message || "");
      formData.append("isAnonymous", "false");
      formData.append("responderId", authUser.id || "");
      if (audioFile) formData.append("audio", audioFile);

      setReplySubmitting(!audioFile);
      setAudioUploading(Boolean(audioFile));
      setReplyNotice("");

      try {
        const response = await fetch("/api/responses", { method: "POST", body: formData });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || "回覆送出失敗，請稍後再試。");
        }
        const saved = await response.json();
        window.dispatchEvent(new CustomEvent(PRAYER_RESPONSE_CREATED, { detail: saved }));
        setReplyText("");
      setReplyNotice(audioFile ? "語音禱告已上傳。" : "已送出你的禱告回應。");
        setFlashClusterId(modalCluster?.id || selectedCluster?.id || null);
        window.setTimeout(() => setFlashClusterId(null), 1800);
      } catch (error) {
        setReplyNotice(error?.message || "回覆送出失敗，請稍後再試。");
      } finally {
        setReplySubmitting(false);
        setAudioUploading(false);
      }
    },
    [audioUploading, authUser, drawerPrayer, modalCluster?.id, replySubmitting, selectedCluster?.id]
  );

  const handleSharePrayer = useCallback(async () => {
    if (!drawerPrayer || typeof window === "undefined") return;
    const url = `${window.location.origin}/prayfor/${drawerPrayer.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: getPrayerTitle(drawerPrayer), text: getPrayerDescription(drawerPrayer), url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setReplyNotice("分享連結已準備好。");
    } catch (error) {
      if (error?.name !== "AbortError") setReplyNotice("分享失敗，請稍後再試。");
    }
  }, [drawerPrayer]);

  return (
    <section className={`gpr-page${focusListeningActive ? " is-focus-listening" : ""}`} aria-labelledby="gpr-page-title">
      <div className="gpr-page__ambient" aria-hidden="true" />
      <div className="gpr-page__stars" aria-hidden="true" />
      <div className="gpr-page__radar" aria-hidden="true" />
      <div className="gpr-page__shell">
        <section className="gpr-page__main" aria-label="全球禱告地球">
          <div className="gpr-page__stage">
            <div className="gpr-page__stage-glow" aria-hidden="true" />
            <header className="gpr-page__intro">
              <div>
                <p className="gpr-page__eyebrow">全球禱告室</p>
                <h1 id="gpr-page-title">看見世界正在被守望</h1>
                <p>看見全球正在被守望的禱告光點，快速定位國家、聆聽語音並加入代禱。</p>
              </div>
              <Link className="gpr-page__intro-link" href="/customer-portal/create">
                新增代禱
              </Link>
            </header>
            {showGuide ? (
              <div className="gpr-guide" role="status">
                <span>拖曳地球</span>
                <span>點擊光點</span>
                <span>播放語音</span>
                <span>加入禱告</span>
                <button type="button" onClick={dismissGuide}>
                  我知道了
                </button>
              </div>
            ) : null}
            <div className="gpr-page__focus-chip">
              <span>目前焦點</span>
              <strong>{selectedCluster?.fullLabel || "台北，台灣"}</strong>
              {flashClusterId && flashClusterId === selectedCluster?.id ? <em>剛剛更新</em> : null}
            </div>
            <form className="gpr-page__country-search" onSubmit={handleCountrySearch}>
              <label htmlFor="gpr-country-search">搜尋地點或代禱</label>
              <div>
                <input
                  id="gpr-country-search"
                  value={countryQuery}
                  onChange={(event) => {
                    setCountryQuery(event.target.value);
                    setSearchQuery(event.target.value);
                    setCountrySearchMessage("");
                  }}
                  placeholder="搜尋國家、城市或代禱事項"
                  autoComplete="off"
                />
                <button type="submit">前往</button>
              </div>
              {countrySearchMessage ? <p role="status">{countrySearchMessage}</p> : null}
            </form>
            <GlobalPrayerGlobe
              ref={globeRef}
              clusters={displayClusters}
              heroMap
              onSelectCluster={handleSelectCluster}
              onBlankClick={closePopup}
              onHoverCluster={setHoveredCluster}
              onAutoRotateChange={() => {}}
              onReady={() => globeRef.current?.showTaiwan?.()}
            />
            {hoveredCluster ? (
              <div className="gpr-page__tooltip" role="status">
                <strong>{hoveredCluster.fullLabel}</strong>
                <span>{getPrayerTitle(hoveredCluster.prayers?.[0])}</span>
                <small>
                  {formatRelativeTime(hoveredCluster.latestCreatedAt)}
                  {Number(hoveredCluster.audioCount || 0) > 0 ? " · 語音" : ""}
                </small>
              </div>
            ) : null}
            <div className="gpr-page__map-controls" aria-label="地圖控制">
              <button type="button" onClick={() => globeRef.current?.showTaiwan?.()}>
                台灣
              </button>
              <button type="button" onClick={() => globeRef.current?.resetTaipei?.()}>
                台北
              </button>
              <button type="button" onClick={() => globeRef.current?.resetView?.()}>
                全球視角
              </button>
              <button type="button" onClick={() => globeRef.current?.zoomIn?.()}>
                +
              </button>
              <button type="button" onClick={() => globeRef.current?.zoomOut?.()}>
                -
              </button>
              <button type="button" onClick={() => globeRef.current?.showAllMarkers?.()}>
                熱點總覽
              </button>
            </div>
          </div>

        </section>
      </div>

      {focusListeningActive ? (
        <div className="gpr-focus-listening" aria-live="polite">
          <span>正在聆聽</span>
          <strong>{currentTrack?.country || currentTrack?.requestTitle || selectedCluster?.fullLabel || "全球禱告"}</strong>
          <p>{currentTrack?.message || currentTrack?.requestTitle || "正在聆聽一段全球禱告語音。"}</p>
          <div className="gpr-focus-listening__wave" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
        </div>
      ) : null}

      {modalCluster ? (
        <div
          className="gpr-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${modalCluster.fullLabel} 代禱內容`}
        >
          <button
            className="gpr-modal__backdrop"
            type="button"
            onClick={closePopup}
            aria-label="關閉"
          />
          <article className="gpr-modal__card gpr-drawer">
            <button className="gpr-modal__close" type="button" onClick={closePopup}>
              關閉
            </button>
            <span className="gpr-drawer__location">{modalCluster.fullLabel}</span>
            <h2>{getPrayerTitle(drawerPrayer)}</h2>
            <div className="gpr-drawer__chips">
              <span style={{ "--layer-color": getCategoryColor(drawerPrayer?.categoryKey) }}>
                {drawerPrayer?.categoryLabel || modalCluster.categoryLabel}
              </span>
              <span>{formatRelativeTime(drawerPrayer?.createdAt || modalCluster.latestCreatedAt)}</span>
              {drawerPrayer?.isUrgent ? <span className="is-urgent">需要守望</span> : null}
            </div>
            <p>{getPrayerDescription(drawerPrayer) || "這個城市有人需要被守望。"}</p>
            {drawerPrayer?.id && !drawerPrayer?.isPrivate ? (
              <Link className="gpr-drawer__detail-link" href={`/prayfor/${drawerPrayer.id}`} prefetch={false}>
                查看禱告詳情
              </Link>
            ) : null}
            <div className="gpr-drawer__metrics">
              <article>
                <strong>{drawerPrayer?.prayerCount || 1}</strong>
                <span>代禱</span>
              </article>
              <article>
                <strong>{drawerPrayer?.responseCount || 0}</strong>
                <span>回應</span>
              </article>
              <article>
                <strong>{getPrayerAudioCount(drawerPrayer)}</strong>
                <span>語音</span>
              </article>
            </div>
            <div className="gpr-modal__actions">
              <button type="button" onClick={() => handlePlayAudio(drawerPrayer)}>
                播放語音
              </button>
              <button type="button" onClick={() => submitPrayerResponse({ message: "我已代禱" })}>
                我已代禱
              </button>
              <button type="button" onClick={() => setDrawerMode("prayer")}>
                回應
              </button>
              <button type="button" onClick={handleSharePrayer}>
                分享
              </button>
              <button type="button" onClick={() => setReplyNotice("檢舉流程沿用既有詳細頁權限與審核規則，未改動 API。")}>
                檢舉
              </button>
            </div>
            <div className="gpr-response-modes" aria-label="回覆類型">
              {[
                ["pray", "我已代禱"],
                ["prayer", "留下禱告"],
                ["record", "錄製禱告"],
                ["encouragement", "鼓勵"],
                ["testimony", "見證"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={drawerMode === key ? "is-active" : ""}
                  onClick={() => {
                    setDrawerMode(key);
                    if (key === "pray") setReplyText("我已代禱");
                    if (key === "encouragement") setReplyText("願你得著安慰、力量與平安。");
                    if (key === "testimony") setReplyText("我想分享一段見證：");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {drawerMode === "record" ? (
              <label className="gpr-audio-upload">
                <span>{audioUploading ? "上傳中..." : "上傳語音禱告"}</span>
                <input
                  type="file"
                  accept="audio/*"
                  disabled={audioUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) submitPrayerResponse({ message: "", audioFile: file });
                    event.target.value = "";
                  }}
                />
              </label>
            ) : (
              <form
                className="gpr-reply-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitPrayerResponse({ message: replyText });
                }}
              >
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="寫下一段簡短禱告、鼓勵或見證。"
                  rows={3}
                />
                <button type="submit" disabled={replySubmitting || !replyText.trim()}>
                  {replySubmitting ? "送出中..." : "送出回應"}
                </button>
              </form>
            )}
            {replyNotice ? <p className="gpr-drawer__notice" role="status">{replyNotice}</p> : null}
            <div className="gpr-drawer__footnote">
              <span>登入用戶可建立新代禱事項。</span>
              <span>訪客目前可瀏覽與分享；語音上傳沿用既有回覆 API 權限。</span>
            </div>
          </article>
        </div>
      ) : null}

      <style jsx>{`
        .gpr-page {
          position: relative;
          left: 50%;
          width: 100vw;
          min-height: calc(100vh - var(--site-header-height, 64px));
          margin-left: -50vw;
          overflow: hidden;
          color: #e5edf8;
          background:
            radial-gradient(circle at 45% 35%, rgba(14, 165, 233, 0.18), transparent 34%),
            radial-gradient(circle at 78% 20%, rgba(250, 204, 21, 0.08), transparent 28%),
            linear-gradient(135deg, #020617 0%, #0f172a 48%, #020617 100%);
        }

        .gpr-page__ambient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.22;
          background-image:
            linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(circle at 50% 35%, black, transparent 72%);
        }

        .gpr-page__stars {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.34;
          background-image:
            radial-gradient(circle at 12% 18%, rgba(226, 232, 240, 0.9) 0 1px, transparent 1.6px),
            radial-gradient(circle at 78% 12%, rgba(125, 211, 252, 0.72) 0 1px, transparent 1.7px),
            radial-gradient(circle at 58% 72%, rgba(226, 232, 240, 0.62) 0 1px, transparent 1.8px),
            radial-gradient(circle at 28% 82%, rgba(250, 204, 21, 0.54) 0 1px, transparent 1.8px);
          background-size: 240px 180px, 310px 220px, 280px 260px, 360px 280px;
        }

        .gpr-page__shell {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          width: min(1800px, calc(100% - 2rem));
          min-height: calc(100vh - var(--site-header-height, 64px));
          margin: 0 auto;
          padding: 4.5rem 0 1rem;
        }

        .gpr-page__main,
        .gpr-page__side {
          min-width: 0;
        }

        .gpr-page__main {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .gpr-page__side {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .gpr-page__intro {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 1rem;
          max-width: min(520px, calc(100vw - 2rem));
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 1rem;
          padding: 0.85rem;
          background: rgba(4, 10, 22, 0.42);
          box-shadow: 0 20px 70px rgba(2, 6, 23, 0.22);
          backdrop-filter: blur(14px);
        }

        .gpr-page__eyebrow,
        .gpr-card__header p {
          margin: 0 0 0.35rem;
          color: #67e8f9;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .gpr-page__intro h1 {
          margin: 0;
          color: #f8fafc;
          font-size: clamp(1.5rem, 2.3vw, 2.25rem);
          line-height: 1;
          letter-spacing: 0;
        }

        .gpr-page__intro p:not(.gpr-page__eyebrow) {
          max-width: 420px;
          margin: 0.55rem 0 0;
          color: #bfd0e5;
          font-size: 0.86rem;
          line-height: 1.6;
        }

        .gpr-page__intro-link,
        .gpr-page__actions a,
        .gpr-page__actions button,
        .gpr-modal__actions a {
          min-height: 44px;
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 999px;
          padding: 0.7rem 1rem;
          color: #e0f2fe;
          font-weight: 800;
          text-decoration: none;
          background: rgba(14, 165, 233, 0.16);
          transition:
            border-color 180ms ease,
            background 180ms ease,
            transform 180ms ease;
        }

        .gpr-page__intro-link:hover,
        .gpr-page__actions a:hover,
        .gpr-page__actions button:hover,
        .gpr-modal__actions a:hover {
          border-color: rgba(103, 232, 249, 0.48);
          background: rgba(14, 165, 233, 0.28);
          transform: translateY(-1px);
        }

        .gpr-page__statusbar {
          position: absolute;
          top: 1rem;
          left: 1rem;
          right: 1rem;
          z-index: 6;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          min-height: 48px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.9rem;
          padding: 0.45rem 0.55rem 0.45rem 0.8rem;
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 18px 70px rgba(2, 6, 23, 0.24);
          backdrop-filter: blur(18px);
        }

        .gpr-page__status-items,
        .gpr-page__actions {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          flex-wrap: wrap;
        }

        .gpr-page__status-items span {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          padding: 0.45rem 0.7rem;
          color: #cbd5e1;
          font-size: 0.82rem;
          background: rgba(2, 6, 23, 0.28);
        }

        .gpr-page__actions button {
          cursor: pointer;
          font: inherit;
        }

        .gpr-page__stage {
          position: relative;
          height: calc(100vh - 132px);
          min-height: 600px;
          max-height: none;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          background:
            radial-gradient(circle at 60% 40%, rgba(56, 189, 248, 0.18), transparent 50%),
            rgba(15, 23, 42, 0.7);
          box-shadow:
            0 30px 110px rgba(2, 6, 23, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .gpr-page__stage-glow {
          position: absolute;
          inset: 12% 18%;
          border-radius: 999px;
          background:
            radial-gradient(circle, rgba(125, 211, 252, 0.16), transparent 46%),
            radial-gradient(circle at 48% 58%, rgba(250, 204, 21, 0.1), transparent 38%);
          filter: blur(90px);
          pointer-events: none;
        }

        .gpr-guide {
          position: absolute;
          z-index: 8;
          left: 50%;
          top: 1rem;
          display: flex;
          align-items: center;
          gap: 0.45rem;
          max-width: calc(100% - 2rem);
          overflow-x: auto;
          border: 1px solid rgba(125, 211, 252, 0.2);
          border-radius: 999px;
          padding: 0.4rem;
          color: #dbeafe;
          background: rgba(2, 6, 23, 0.72);
          box-shadow: 0 18px 60px rgba(2, 6, 23, 0.36);
          transform: translateX(-50%);
          backdrop-filter: blur(16px);
        }

        .gpr-guide span,
        .gpr-guide button,
        .gpr-search-chips button,
        .gpr-recent__chips button {
          min-height: 30px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          padding: 0.25rem 0.58rem;
          color: #cbd5e1;
          background: rgba(15, 23, 42, 0.7);
          font-size: 0.72rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .gpr-guide button,
        .gpr-search-chips button,
        .gpr-recent__chips button {
          cursor: pointer;
        }

        .gpr-page__focus-chip,
        .gpr-page__country-search,
        .gpr-page__hot-countries,
        .gpr-page__legend,
        .gpr-page__stage-metrics {
          position: absolute;
          z-index: 5;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(2, 6, 23, 0.62);
          box-shadow: 0 18px 70px rgba(2, 6, 23, 0.24);
          backdrop-filter: blur(18px);
        }

        .gpr-page__focus-chip {
          top: 1rem;
          left: 1rem;
          max-width: min(360px, calc(100% - 2rem));
          border-radius: 1rem;
          padding: 0.75rem 0.9rem;
        }

        .gpr-page__focus-chip span,
        .gpr-page__stage-metrics span,
        .gpr-muted {
          color: #94a3b8;
          font-size: 0.82rem;
        }

        .gpr-page__focus-chip strong {
          display: block;
          margin-top: 0.2rem;
          color: #f8fafc;
        }

        .gpr-page__focus-chip em {
          display: inline-block;
          margin-top: 0.35rem;
          border-radius: 999px;
          padding: 0.18rem 0.45rem;
          color: #fef3c7;
          font-size: 0.72rem;
          font-style: normal;
          font-weight: 900;
          background: rgba(250, 204, 21, 0.16);
        }

        .gpr-page__country-search {
          top: 1rem;
          right: 1rem;
          display: grid;
          gap: 0.32rem;
          width: min(340px, calc(100% - 2rem));
          border-radius: 999px;
          padding: 0.42rem;
          background: rgba(2, 6, 23, 0.52);
        }

        .gpr-page__country-search label {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
        }

        .gpr-page__country-search div {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.45rem;
        }

        .gpr-page__country-search input,
        .gpr-page__country-search button,
        .gpr-page__hot-countries button {
          min-height: 36px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.78);
          color: #e0f2fe;
          font: inherit;
          font-weight: 800;
        }

        .gpr-page__country-search input {
          min-width: 0;
          padding: 0 0.7rem;
        }

        .gpr-page__country-search button,
        .gpr-page__hot-countries button {
          cursor: pointer;
          padding: 0 0.72rem;
        }

        .gpr-page__country-search button:hover,
        .gpr-page__country-search button:focus-visible,
        .gpr-page__hot-countries button:hover,
        .gpr-page__hot-countries button:focus-visible {
          border-color: rgba(34, 211, 238, 0.5);
          outline: none;
        }

        .gpr-page__country-search p {
          position: absolute;
          top: calc(100% + 0.4rem);
          right: 0;
          margin: 0;
          border-radius: 999px;
          padding: 0.28rem 0.6rem;
          color: #fef08a;
          font-size: 0.78rem;
          font-weight: 800;
          background: rgba(2, 6, 23, 0.72);
        }

        .gpr-search-chips,
        .gpr-recent__chips {
          display: flex;
          gap: 0.35rem;
          overflow-x: auto;
        }

        .gpr-page__hot-countries {
          top: 10.2rem;
          right: 1rem;
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          max-width: min(340px, calc(100% - 2rem));
          border: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
        }

        .gpr-layer-strip {
          position: absolute;
          z-index: 6;
          left: 1rem;
          right: 1rem;
          bottom: 4.7rem;
          display: flex;
          gap: 0.45rem;
          overflow-x: auto;
          padding-bottom: 0.1rem;
          scrollbar-width: thin;
        }

        .gpr-layer-strip button,
        .gpr-intel__tabs button,
        .gpr-response-modes button {
          min-height: 34px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 999px;
          padding: 0.35rem 0.65rem;
          color: #cbd5e1;
          background: rgba(2, 6, 23, 0.64);
          cursor: pointer;
          font: inherit;
          font-size: 0.76rem;
          font-weight: 900;
          white-space: nowrap;
        }

        .gpr-layer-strip button {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          backdrop-filter: blur(14px);
        }

        .gpr-layer-strip i {
          width: 0.55rem;
          height: 0.55rem;
          border-radius: 999px;
          background: var(--layer-color);
          box-shadow: 0 0 18px var(--layer-color);
        }

        .gpr-layer-strip button.is-active,
        .gpr-intel__tabs button.is-active,
        .gpr-response-modes button.is-active {
          border-color: color-mix(in srgb, var(--layer-color, #67e8f9) 58%, white 0%);
          color: #f8fafc;
          background: rgba(14, 165, 233, 0.2);
        }

        .gpr-page__legend {
          right: 1rem;
          bottom: 5rem;
          display: grid;
          gap: 0.45rem;
          border-radius: 1rem;
          padding: 0.75rem;
        }

        .gpr-page__legend span {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          color: #dbeafe;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .gpr-page__legend i {
          width: 0.58rem;
          height: 0.58rem;
          border-radius: 999px;
          box-shadow: 0 0 18px currentColor;
        }

        .gpr-page__legend .is-gold {
          color: #fde68a;
          background: #fde68a;
        }

        .gpr-page__legend .is-cyan {
          color: #67e8f9;
          background: #67e8f9;
        }

        .gpr-page__legend .is-red {
          color: #fb7185;
          background: #fb7185;
        }

        .gpr-page__legend .is-blue {
          color: #bfdbfe;
          background: #bfdbfe;
        }

        .gpr-page__stage-metrics {
          left: 1rem;
          bottom: 1rem;
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          border-radius: 999px;
          padding: 0.6rem 0.75rem;
        }

        .gpr-page__tooltip {
          position: absolute;
          z-index: 7;
          left: 1rem;
          top: 5rem;
          display: grid;
          gap: 0.18rem;
          width: min(260px, calc(100% - 2rem));
          border: 1px solid rgba(125, 211, 252, 0.24);
          border-radius: 0.85rem;
          padding: 0.7rem 0.8rem;
          background: rgba(15, 23, 42, 0.82);
          box-shadow: 0 18px 60px rgba(2, 6, 23, 0.32);
          backdrop-filter: blur(18px);
          pointer-events: none;
        }

        .gpr-page__tooltip strong {
          color: #f8fafc;
          font-size: 0.9rem;
        }

        .gpr-page__tooltip span,
        .gpr-page__tooltip small {
          overflow: hidden;
          color: #cbd5e1;
          font-size: 0.78rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gpr-page__map-controls {
          position: absolute;
          z-index: 7;
          right: 1rem;
          bottom: 1rem;
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .gpr-page__map-controls button {
          min-height: 40px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.75rem;
          background: rgba(15, 23, 42, 0.72);
          color: #e0f2fe;
          cursor: pointer;
          font-weight: 900;
          padding: 0 0.75rem;
          backdrop-filter: blur(16px);
        }

        .gpr-page__map-controls button:hover,
        .gpr-page__map-controls button:focus-visible {
          border-color: rgba(34, 211, 238, 0.48);
          outline: none;
        }

        .gpr-page__insights {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .gpr-page__insights article,
        .gpr-card {
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.25rem;
          background: rgba(15, 23, 42, 0.68);
          box-shadow: 0 18px 70px rgba(2, 6, 23, 0.26);
          backdrop-filter: blur(18px);
        }

        .gpr-page__insights article {
          padding: 1rem;
        }

        .gpr-page__insights span,
        .gpr-page__insights p {
          margin: 0;
          color: #94a3b8;
          font-size: 0.82rem;
        }

        .gpr-page__insights strong {
          display: block;
          margin: 0.2rem 0;
          color: #fde68a;
          font-size: 1.6rem;
          line-height: 1;
        }

        .gpr-card {
          padding: 1rem;
        }

        .gpr-card:hover {
          border-color: rgba(34, 211, 238, 0.3);
        }

        .gpr-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.8rem;
        }

        .gpr-card__header span {
          color: #94a3b8;
          font-size: 0.78rem;
        }

        .gpr-overview {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.65rem;
        }

        .gpr-overview article {
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 1rem;
          padding: 0.75rem;
          background: rgba(2, 6, 23, 0.24);
        }

        .gpr-overview strong,
        .gpr-attention-count {
          display: block;
          color: #fde68a;
          font-size: 1.35rem;
          line-height: 1;
        }

        .gpr-overview span {
          display: block;
          margin-top: 0.35rem;
          color: #94a3b8;
          font-size: 0.78rem;
        }

        .gpr-card--amber {
          border-color: rgba(251, 191, 36, 0.18);
          background: linear-gradient(135deg, rgba(120, 53, 15, 0.24), rgba(15, 23, 42, 0.68));
        }

        .gpr-card--amber {
          padding: 0.85rem 1rem;
        }

        .gpr-intel {
          display: grid;
          gap: 0.75rem;
          padding: 0.85rem;
        }

        .gpr-intel__tabs {
          display: flex;
          gap: 0.4rem;
          overflow-x: auto;
          padding-bottom: 0.05rem;
        }

        .gpr-intel__list {
          display: grid;
          gap: 0.35rem;
          max-height: min(48vh, 520px);
          overflow: auto;
          padding-right: 0.15rem;
        }

        .gpr-intel__list > button {
          display: grid;
          gap: 0.32rem;
          width: 100%;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 0.75rem;
          padding: 0.65rem;
          color: inherit;
          text-align: left;
          background: rgba(2, 6, 23, 0.24);
          cursor: pointer;
        }

        .gpr-intel__list > button:hover,
        .gpr-intel__list > button:focus-visible,
        .gpr-intel__list > button.is-active {
          border-color: rgba(34, 211, 238, 0.36);
          background: rgba(8, 47, 73, 0.32);
          outline: none;
        }

        .gpr-intel__row-top,
        .gpr-intel__meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          min-width: 0;
          color: #94a3b8;
          font-size: 0.72rem;
        }

        .gpr-intel__row-top b {
          border-radius: 999px;
          padding: 0.18rem 0.42rem;
          color: #f8fafc;
          font-size: 0.68rem;
          background: color-mix(in srgb, var(--layer-color) 28%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--layer-color) 55%, transparent);
        }

        .gpr-intel__row-top em {
          flex: 0 0 auto;
          font-style: normal;
        }

        .gpr-intel__list strong {
          overflow: hidden;
          color: #f8fafc;
          font-size: 0.88rem;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gpr-intel__meta {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gpr-current h2,
        .gpr-current h3,
        .gpr-current p {
          margin: 0;
        }

        .gpr-current h2 {
          color: #f8fafc;
          font-size: 1.25rem;
        }

        .gpr-current h3 {
          margin-top: 0.75rem;
          color: #dbeafe;
          font-size: 1rem;
          line-height: 1.45;
        }

        .gpr-current p {
          display: -webkit-box;
          margin-top: 0.65rem;
          overflow: hidden;
          color: #b6c7dc;
          line-height: 1.7;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
        }

        .gpr-current__meta {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.9rem;
        }

        .gpr-current__meta span,
        .gpr-latest em {
          border-radius: 999px;
          padding: 0.32rem 0.55rem;
          color: #bae6fd;
          font-size: 0.74rem;
          font-style: normal;
          font-weight: 800;
          background: rgba(14, 165, 233, 0.12);
        }

        .gpr-latest {
          display: grid;
          gap: 0;
        }

        .gpr-latest button {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.18rem 0.65rem;
          width: 100%;
          min-height: 58px;
          border: 0;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 0;
          padding: 0.7rem 0;
          color: inherit;
          text-align: left;
          background: transparent;
          cursor: pointer;
          transition:
            border-color 180ms ease,
            background 180ms ease,
            transform 180ms ease;
        }

        .gpr-latest button:hover,
        .gpr-latest button:focus-visible {
          border-color: rgba(34, 211, 238, 0.32);
          background: rgba(8, 47, 73, 0.16);
          outline: none;
          transform: none;
        }

        .gpr-latest__meta {
          grid-column: 1 / -1;
          color: #94a3b8;
          font-size: 0.75rem;
        }

        .gpr-latest strong {
          color: #f8fafc;
          font-size: 0.92rem;
          line-height: 1.45;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .gpr-modal {
          position: fixed;
          inset: 0;
          z-index: 80;
          pointer-events: none;
        }

        .gpr-modal__backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          pointer-events: auto;
        }

        .gpr-modal__card {
          position: absolute;
          top: clamp(1rem, 3vw, 2rem);
          right: clamp(1rem, 3vw, 2rem);
          bottom: clamp(1rem, 3vw, 2rem);
          width: min(430px, calc(100vw - 2rem));
          overflow: auto;
          border: 1px solid rgba(34, 211, 238, 0.22);
          border-radius: 0.85rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.96);
          box-shadow: 0 30px 110px rgba(2, 6, 23, 0.55);
          backdrop-filter: blur(22px);
          pointer-events: auto;
        }

        .gpr-modal__close {
          position: absolute;
          top: 0.85rem;
          right: 0.85rem;
          min-height: 36px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 0.35rem 0.7rem;
          color: #dbeafe;
          background: rgba(2, 6, 23, 0.42);
          cursor: pointer;
        }

        .gpr-modal__card span {
          color: #67e8f9;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .gpr-modal__card h2 {
          margin: 0.75rem 0 0;
          color: #f8fafc;
          font-size: 1.35rem;
        }

        .gpr-modal__card p {
          margin: 0.75rem 0 0;
          color: #cbd5e1;
          line-height: 1.75;
        }

        .gpr-modal__actions {
          display: flex;
          gap: 0.65rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .gpr-modal__actions button,
        .gpr-modal__actions a,
        .gpr-reply-form button,
        .gpr-audio-upload {
          min-height: 40px;
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 0.7rem;
          padding: 0.62rem 0.75rem;
          color: #e0f2fe;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 900;
          text-decoration: none;
          background: rgba(14, 165, 233, 0.14);
          cursor: pointer;
        }

        .gpr-drawer__location {
          display: block;
          padding-right: 4rem;
        }

        .gpr-drawer__detail-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 42px;
          margin-top: 0.85rem;
          border: 1px solid rgba(253, 230, 138, 0.42);
          border-radius: 999px;
          padding: 0 1rem;
          color: #241a05;
          font-size: 0.86rem;
          font-weight: 900;
          text-decoration: none;
          background: #f7d77a;
          box-shadow: 0 14px 34px rgba(250, 204, 21, 0.16);
        }

        .gpr-drawer__chips,
        .gpr-drawer__metrics,
        .gpr-response-modes,
        .gpr-drawer__footnote {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          margin-top: 0.75rem;
        }

        .gpr-drawer__chips span {
          border-radius: 999px;
          padding: 0.25rem 0.5rem;
          color: #dbeafe;
          font-size: 0.72rem;
          font-weight: 900;
          background: rgba(148, 163, 184, 0.12);
        }

        .gpr-drawer__chips span:first-child {
          background: color-mix(in srgb, var(--layer-color) 24%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--layer-color) 52%, transparent);
        }

        .gpr-drawer__chips .is-urgent {
          color: #fecaca;
          background: rgba(239, 68, 68, 0.2);
        }

        .gpr-drawer__metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .gpr-drawer__metrics article {
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 0.8rem;
          padding: 0.65rem;
          background: rgba(2, 6, 23, 0.28);
        }

        .gpr-drawer__metrics strong {
          display: block;
          color: #fde68a;
          font-size: 1.25rem;
        }

        .gpr-drawer__metrics span,
        .gpr-drawer__footnote span {
          color: #94a3b8;
          font-size: 0.72rem;
        }

        .gpr-reply-form {
          display: grid;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .gpr-reply-form textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 0.75rem;
          padding: 0.7rem;
          color: #f8fafc;
          background: rgba(2, 6, 23, 0.36);
          resize: vertical;
        }

        .gpr-audio-upload {
          display: grid;
          place-items: center;
          margin-top: 0.75rem;
          text-align: center;
        }

        .gpr-audio-upload input {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          opacity: 0;
          pointer-events: none;
        }

        .gpr-drawer__notice {
          margin: 0.75rem 0 0;
          border: 1px solid rgba(250, 204, 21, 0.22);
          border-radius: 0.75rem;
          padding: 0.65rem;
          color: #fef3c7;
          background: rgba(120, 53, 15, 0.18);
        }

        .gpr-page__stage :global(.global-room__canvas) {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          border-radius: 0 !important;
          background: transparent !important;
          cursor: grab !important;
          touch-action: pan-y !important;
        }

        .gpr-page__stage :global(.global-room__canvas canvas),
        .gpr-page__stage :global(.cesium-viewer),
        .gpr-page__stage :global(.cesium-viewer-cesiumWidgetContainer),
        .gpr-page__stage :global(.cesium-widget),
        .gpr-page__stage :global(.cesium-widget canvas) {
          width: 100% !important;
          height: 100% !important;
          touch-action: pan-y !important;
        }

        .gpr-page__radar {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          opacity: 0.08;
          background:
            radial-gradient(circle at 54% 48%, transparent 0 28%, rgba(125, 211, 252, 0.12) 28.2% 28.7%, transparent 29% 100%);
        }

        .gpr-page__shell {
          width: 100%;
          min-height: calc(100svh - var(--site-header-height, 56px));
          padding: 0;
          display: block;
        }

        .gpr-page__main {
          min-height: calc(100svh - var(--site-header-height, 56px));
        }

        .gpr-page__intro {
          position: absolute;
          z-index: 12;
          left: clamp(1rem, 2.5vw, 2rem);
          top: clamp(0.75rem, 2vh, 1.25rem);
          display: grid;
          gap: 0.65rem;
          width: min(360px, calc(100vw - 2rem));
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          padding: 0.95rem;
          background: rgba(4, 10, 22, 0.52);
          box-shadow: 0 20px 70px rgba(2, 6, 23, 0.24);
          backdrop-filter: blur(18px);
        }

        .gpr-page__intro h1 {
          font-size: clamp(1.6rem, 2.7vw, 2.6rem);
          line-height: 1.04;
        }

        .gpr-page__intro p:not(.gpr-page__eyebrow) {
          max-width: none;
          margin-top: 0.5rem;
          font-size: 0.88rem;
          line-height: 1.65;
          color: rgba(203, 213, 225, 0.74);
        }

        .gpr-page__intro-link {
          min-height: 36px;
          width: fit-content;
          border-radius: 999px;
          padding: 0.48rem 0.78rem;
          font-size: 0.78rem;
          box-shadow: none;
        }

        .gpr-page__stage {
          height: calc(100svh - var(--site-header-height, 56px));
          min-height: 680px;
          border: 0;
          border-radius: 0;
          background: #020617;
          box-shadow: none;
        }

        .gpr-page__stage::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
          background:
            radial-gradient(circle at 54% 48%, transparent 0 35%, rgba(2, 6, 23, 0.32) 76%),
            linear-gradient(0deg, rgba(2, 6, 23, 0.78), transparent 34%, rgba(2, 6, 23, 0.12));
        }

        .gpr-page__statusbar,
        .gpr-page__focus-chip,
        .gpr-page__legend,
        .gpr-page__stage-metrics,
        .gpr-page__hot-countries,
        .gpr-layer-strip {
          opacity: 0.78;
        }

        .gpr-page__statusbar {
          top: auto;
          left: clamp(1rem, 2vw, 1.5rem);
          right: auto;
          bottom: 5.6rem;
          width: auto;
          max-width: min(520px, calc(100vw - 2rem));
          border-radius: 999px;
          padding: 0.45rem 0.55rem;
          background: rgba(4, 10, 22, 0.46);
        }

        .gpr-page__actions a,
        .gpr-page__actions button,
        .gpr-page__map-controls button {
          min-height: 34px;
          border-radius: 999px;
          padding-inline: 0.65rem;
          font-size: 0.74rem;
          background: rgba(15, 23, 42, 0.56);
        }

        .gpr-page__country-search {
          top: 1rem;
          right: clamp(7rem, 9vw, 8rem);
          width: min(340px, calc(100vw - 2rem));
          border-radius: 999px;
          padding: 0.45rem;
          background: rgba(4, 10, 22, 0.5);
        }

        .gpr-page__country-search label,
        .gpr-page__country-search p,
        .gpr-search-chips {
          display: none;
        }

        .gpr-page__country-search div {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
        }

        .gpr-page__country-search input,
        .gpr-page__country-search button {
          min-height: 36px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.48);
        }

        .gpr-page__country-search:focus-within {
          border-radius: 1rem;
        }

        .gpr-page__country-search:focus-within label,
        .gpr-page__country-search:focus-within p,
        .gpr-page__country-search:focus-within .gpr-search-chips {
          display: flex;
        }

        .gpr-page__focus-chip {
          top: auto;
          left: clamp(1rem, 2vw, 1.5rem);
          bottom: 8.8rem;
          max-width: min(300px, calc(100vw - 2rem));
          border-radius: 999px;
          padding: 0.52rem 0.72rem;
          background: rgba(4, 10, 22, 0.48);
        }

        .gpr-page__focus-chip span,
        .gpr-page__focus-chip em {
          display: none;
        }

        .gpr-page__focus-chip strong {
          margin: 0;
          font-size: 0.84rem;
        }

        .gpr-layer-strip {
          left: clamp(1rem, 2vw, 1.5rem);
          right: auto;
          bottom: 2rem;
          max-width: min(620px, calc(100vw - 2rem));
        }

        .gpr-layer-strip button {
          min-height: 30px;
          padding: 0.25rem 0.58rem;
          font-size: 0.68rem;
          background: rgba(4, 10, 22, 0.5);
        }

        .gpr-page__legend,
        .gpr-page__stage-metrics {
          display: none;
        }

        .gpr-page__map-controls {
          right: clamp(1rem, 2vw, 1.5rem);
          bottom: 1rem;
          max-width: 360px;
        }

        .gpr-page__tooltip {
          left: auto;
          right: clamp(1rem, 2vw, 1.5rem);
          top: 7rem;
          width: min(240px, calc(100% - 2rem));
          border-radius: 14px;
          padding: 0.62rem 0.7rem;
          background: rgba(4, 10, 22, 0.68);
        }

        .gpr-page__insights {
          display: none;
        }

        .gpr-page__side {
          position: absolute;
          z-index: 20;
          top: clamp(4.6rem, 9vh, 6rem);
          right: clamp(0.75rem, 2vw, 1.25rem);
          display: grid;
          gap: 0.65rem;
          width: 88px;
          max-height: calc(100svh - var(--site-header-height, 56px) - 8rem);
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 18px;
          padding: 0.7rem;
          background: rgba(4, 10, 22, 0.54);
          box-shadow: 0 22px 70px rgba(2, 6, 23, 0.26);
          backdrop-filter: blur(18px);
          opacity: 0.86;
          transition: width 220ms ease, opacity 220ms ease;
        }

        .gpr-page__side:hover,
        .gpr-page__side:focus-within {
          width: min(340px, calc(100vw - 2rem));
          overflow: auto;
          opacity: 1;
        }

        .gpr-card {
          border: 0;
          border-radius: 0;
          padding: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
        }

        .gpr-card:hover {
          border-color: transparent;
        }

        .gpr-card__header {
          margin-bottom: 0.45rem;
          gap: 0.4rem;
        }

        .gpr-page__side:not(:hover):not(:focus-within) .gpr-card__header span,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-overview span,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-intel__tabs,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-intel__list strong,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-intel__meta,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-current h3,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-current p,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-current__meta,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-card--amber,
        .gpr-page__side:not(:hover):not(:focus-within) .gpr-recent {
          display: none;
        }

        .gpr-overview {
          grid-template-columns: 1fr;
          gap: 0.4rem;
        }

        .gpr-page__side:hover .gpr-overview,
        .gpr-page__side:focus-within .gpr-overview {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .gpr-overview article {
          border-radius: 11px;
          padding: 0.58rem;
          background: rgba(15, 23, 42, 0.38);
        }

        .gpr-overview strong,
        .gpr-attention-count {
          color: #fde68a;
          font-size: 1rem;
        }

        .gpr-intel__list {
          max-height: 42vh;
        }

        .gpr-intel__list > button {
          border-radius: 11px;
          padding: 0.58rem;
          background: rgba(15, 23, 42, 0.34);
        }

        .gpr-intel__list strong {
          white-space: normal;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .gpr-current h2 {
          font-size: 1rem;
          line-height: 1.25;
        }

        .gpr-modal__card {
          background: rgba(4, 10, 22, 0.92);
        }

        .gpr-focus-listening {
          position: absolute;
          z-index: 22;
          left: 50%;
          top: 50%;
          width: min(420px, calc(100vw - 2rem));
          transform: translate(-50%, -50%);
          display: grid;
          justify-items: center;
          gap: 0.55rem;
          border: 1px solid rgba(125, 211, 252, 0.16);
          border-radius: 22px;
          padding: 1.2rem;
          color: #e2e8f0;
          text-align: center;
          background: rgba(2, 6, 23, 0.36);
          backdrop-filter: blur(16px);
          pointer-events: none;
        }

        .gpr-focus-listening span {
          color: #67e8f9;
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .gpr-focus-listening strong {
          color: #f8fafc;
          font-size: 1.15rem;
        }

        .gpr-focus-listening p {
          margin: 0;
          color: rgba(203, 213, 225, 0.76);
          line-height: 1.65;
        }

        .gpr-focus-listening__wave {
          display: flex;
          align-items: end;
          gap: 4px;
          height: 28px;
          color: #67e8f9;
        }

        .gpr-focus-listening__wave i {
          width: 4px;
          border-radius: 999px;
          background: currentColor;
          animation: gpr-focus-wave 900ms ease-in-out infinite;
        }

        .gpr-focus-listening__wave i:nth-child(1) { height: 10px; }
        .gpr-focus-listening__wave i:nth-child(2) { height: 22px; animation-delay: 100ms; }
        .gpr-focus-listening__wave i:nth-child(3) { height: 16px; animation-delay: 200ms; }
        .gpr-focus-listening__wave i:nth-child(4) { height: 26px; animation-delay: 300ms; }
        .gpr-focus-listening__wave i:nth-child(5) { height: 12px; animation-delay: 400ms; }

        .gpr-page.is-focus-listening .gpr-page__intro,
        .gpr-page.is-focus-listening .gpr-page__country-search,
        .gpr-page.is-focus-listening .gpr-page__side,
        .gpr-page.is-focus-listening .gpr-page__statusbar,
        .gpr-page.is-focus-listening .gpr-layer-strip,
        .gpr-page.is-focus-listening .gpr-page__map-controls {
          opacity: 0.18;
          transition: opacity 260ms ease;
        }

        @keyframes gpr-focus-wave {
          50% { transform: scaleY(0.42); opacity: 0.62; }
        }

        .gpr-page {
          min-height: calc(100svh - var(--site-header-height, 56px));
        }

        .gpr-page__shell {
          display: block;
          width: 100%;
          min-height: calc(100svh - var(--site-header-height, 56px));
          padding: 0;
        }

        .gpr-page__main {
          position: relative;
          min-height: calc(100svh - var(--site-header-height, 56px));
        }

        .gpr-page__stage {
          position: relative;
          height: calc(100svh - var(--site-header-height, 56px));
          min-height: 640px;
          overflow: hidden;
          border: 0;
          border-radius: 0;
          background: #020617;
          box-shadow: none;
        }

        .gpr-page__stage::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
          background:
            radial-gradient(circle at 56% 46%, transparent 0 35%, rgba(2, 6, 23, 0.34) 78%),
            linear-gradient(0deg, rgba(2, 6, 23, 0.76), transparent 32%, rgba(2, 6, 23, 0.08));
        }

        .gpr-page__intro {
          position: absolute;
          z-index: 12;
          left: clamp(0.9rem, 2.4vw, 2rem);
          top: clamp(0.8rem, 2vh, 1.25rem);
          display: grid;
          gap: 0.62rem;
          width: min(340px, calc(100vw - 2rem));
          border-radius: 16px;
          padding: 0.85rem;
          background: rgba(4, 10, 22, 0.5);
          backdrop-filter: blur(14px);
        }

        .gpr-page__intro h1 {
          font-size: clamp(1.6rem, 2.5vw, 2.35rem);
          line-height: 1.04;
        }

        .gpr-page__intro p:not(.gpr-page__eyebrow) {
          max-width: none;
          font-size: 0.84rem;
          line-height: 1.58;
        }

        .gpr-page__intro-link {
          min-height: 34px;
          width: fit-content;
          padding: 0.45rem 0.75rem;
          font-size: 0.76rem;
        }

        .gpr-page__country-search {
          z-index: 14;
          top: clamp(0.8rem, 2vh, 1.25rem);
          right: clamp(0.9rem, 2.4vw, 2rem);
          width: min(340px, calc(100vw - 2rem));
          border-radius: 999px;
          padding: 0.42rem;
          background: rgba(4, 10, 22, 0.54);
        }

        .gpr-page__focus-chip {
          z-index: 12;
          top: auto;
          left: clamp(0.9rem, 2.4vw, 2rem);
          bottom: 5.1rem;
          max-width: min(300px, calc(100vw - 2rem));
          border-radius: 999px;
          padding: 0.52rem 0.72rem;
          background: rgba(4, 10, 22, 0.5);
        }

        .gpr-page__focus-chip span,
        .gpr-page__focus-chip em {
          display: none;
        }

        .gpr-page__focus-chip strong {
          margin: 0;
          font-size: 0.84rem;
        }

        .gpr-page__legend,
        .gpr-page__stage-metrics,
        .gpr-page__side,
        .gpr-layer-strip,
        .gpr-page__statusbar {
          display: none !important;
        }

        .gpr-page__map-controls {
          z-index: 13;
          right: clamp(0.9rem, 2.4vw, 2rem);
          bottom: 1rem;
          max-width: min(360px, calc(100vw - 2rem));
        }

        @media (max-width: 1180px) {
          .gpr-page__shell {
            width: 100%;
          }

          .gpr-page__side {
            grid-template-columns: none;
          }
        }

        @media (max-width: 760px) {
          .gpr-page__shell {
            width: min(100% - 1rem, 620px);
            padding: 1rem 0;
          }

          .gpr-page__intro,
          .gpr-page__statusbar {
            align-items: stretch;
            flex-direction: column;
          }

          .gpr-page__intro h1 {
            font-size: 2.1rem;
          }

          .gpr-page__intro-link {
            width: 100%;
            text-align: center;
          }

          .gpr-page__statusbar {
            overflow-x: auto;
          }

          .gpr-page__status-items {
            flex-wrap: nowrap;
            min-width: max-content;
          }

          .gpr-page__stage {
            height: 380px;
            min-height: 360px;
            border-radius: 1.1rem;
          }

          .gpr-page__statusbar {
            align-items: stretch;
            flex-direction: column;
            gap: 0.5rem;
          }

          .gpr-page__legend {
            right: 0.75rem;
            bottom: 5.4rem;
          }

          .gpr-page__focus-chip,
          .gpr-page__country-search,
          .gpr-page__hot-countries {
            left: 0.75rem;
            right: 0.75rem;
            width: auto;
            max-width: none;
          }

          .gpr-page__focus-chip {
            top: 4.35rem;
          }

          .gpr-page__country-search {
            top: 8.65rem;
          }

          .gpr-page__hot-countries {
            top: 14rem;
            justify-content: flex-start;
          }

          .gpr-layer-strip {
            top: auto;
            bottom: 4.25rem;
            left: 0.75rem;
            right: 0.75rem;
          }

          .gpr-page__stage-metrics {
            left: 0.75rem;
            bottom: 7.2rem;
            max-width: calc(100% - 1.5rem);
          }

          .gpr-page__map-controls {
            left: 0.75rem;
            right: 0.75rem;
            bottom: 0.75rem;
          }

          .gpr-page__map-controls button {
            flex: 1;
          }

          .gpr-page__insights,
          .gpr-page__side {
            grid-template-columns: 1fr;
          }

          .gpr-modal {
            align-items: end;
            padding: 0.75rem;
          }

          .gpr-modal__card {
            top: auto;
            left: 0.5rem;
            right: 0.5rem;
            bottom: 0.5rem;
            width: auto;
            max-height: 72vh;
            overflow: auto;
          }

          .gpr-page__side {
            order: -1;
          }

          .gpr-intel__list {
            max-height: 420px;
          }

          .gpr-page {
            min-height: calc(100svh - var(--site-header-height, 56px));
          }

          .gpr-page__shell {
            width: 100%;
            padding: 0;
          }

          .gpr-page__main {
            min-height: calc(100svh - var(--site-header-height, 56px));
          }

          .gpr-page__intro {
            position: relative;
            left: auto;
            top: auto;
            width: auto;
            margin: 0.75rem;
            order: 1;
          }

          .gpr-page__intro h1 {
            font-size: 1.8rem;
          }

          .gpr-page__stage {
            height: 62svh;
            min-height: 420px;
            border-radius: 0;
          }

          .gpr-page__country-search {
            position: relative;
            left: auto;
            right: auto;
            top: auto;
            width: auto;
            margin: 0.75rem;
            order: 0;
          }

          .gpr-page__country-search label,
          .gpr-page__country-search p,
          .gpr-search-chips {
            display: flex;
          }

          .gpr-page__side {
            position: relative;
            top: auto;
            right: auto;
            width: auto;
            max-height: none;
            margin: 0.75rem;
            opacity: 1;
            overflow: visible;
            order: 3;
          }

          .gpr-page__side:not(:hover):not(:focus-within) .gpr-card__header span,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-overview span,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-intel__tabs,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-intel__list strong,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-intel__meta,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-current h3,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-current p,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-current__meta,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-card--amber,
          .gpr-page__side:not(:hover):not(:focus-within) .gpr-recent {
            display: initial;
          }

          .gpr-page__focus-chip,
          .gpr-page__statusbar,
          .gpr-layer-strip,
          .gpr-page__map-controls {
            position: absolute;
            left: 0.75rem;
            right: 0.75rem;
          }

          .gpr-page__focus-chip {
            bottom: 8.4rem;
            top: auto;
          }

          .gpr-page__statusbar {
            bottom: 5.3rem;
          }

          .gpr-layer-strip {
            bottom: 2.2rem;
            max-width: none;
          }

          .gpr-page__map-controls {
            bottom: 0.65rem;
          }

          .gpr-focus-listening {
            top: 52%;
            width: min(340px, calc(100vw - 1.5rem));
            padding: 0.9rem;
          }
        }

        @media (max-width: 760px) {
          .gpr-page {
            min-height: calc(100svh - var(--site-header-height, 56px));
          }

          .gpr-page__shell,
          .gpr-page__main {
            width: 100%;
            min-height: calc(100svh - var(--site-header-height, 56px));
            padding: 0;
          }

          .gpr-page__stage {
            height: calc(100svh - var(--site-header-height, 56px));
            min-height: 620px;
            border-radius: 0;
          }

          .gpr-page__intro {
            position: absolute;
            left: 0.75rem;
            right: 0.75rem;
            top: auto;
            bottom: 5.2rem;
            width: auto;
            margin: 0;
            padding: 0.78rem;
            border-radius: 18px;
          }

          .gpr-page__intro h1 {
            font-size: 1.55rem;
          }

          .gpr-page__intro p:not(.gpr-page__eyebrow) {
            font-size: 0.8rem;
            line-height: 1.5;
          }

          .gpr-page__country-search {
            position: absolute;
            left: 0.75rem;
            right: 0.75rem;
            top: 0.75rem;
            width: auto;
            margin: 0;
          }

          .gpr-page__country-search label,
          .gpr-page__country-search p {
            display: none;
          }

          .gpr-page__focus-chip {
            left: 0.75rem;
            right: 0.75rem;
            bottom: 1rem;
            max-width: none;
          }

          .gpr-page__map-controls {
            right: 0.75rem;
            bottom: 1rem;
            left: auto;
            max-width: 144px;
          }

          .gpr-page__map-controls button {
            flex: 0 0 auto;
            min-width: 42px;
          }
        }
      `}</style>
    </section>
  );
}

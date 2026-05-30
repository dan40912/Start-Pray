const zhRegionNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["zh-TW"], { type: "region" })
    : null;

const FEATURED_COUNTRIES = [
  {
    key: "taiwan",
    iso: "TW",
    label: "Taiwan",
    localLabel: "台灣",
    city: "Taipei",
    country: "Taiwan",
    lat: 23.75,
    lng: 120.95,
    globeHeight: 1800000,
    mapZoom: 8,
    aliases: ["tw", "taipei", "台灣", "台湾", "台北"],
  },
  {
    key: "japan",
    iso: "JP",
    label: "Japan",
    localLabel: "日本",
    city: "Tokyo",
    country: "Japan",
    lat: 36.2048,
    lng: 138.2529,
    globeHeight: 2500000,
    mapZoom: 6,
    aliases: ["jp", "tokyo", "日本", "東京", "东京"],
  },
  {
    key: "usa",
    iso: "US",
    label: "USA",
    localLabel: "美國",
    city: "United States",
    country: "United States",
    lat: 39.8283,
    lng: -98.5795,
    globeHeight: 5200000,
    mapZoom: 4,
    aliases: ["us", "u.s.", "u.s.a.", "america", "united states", "美國", "美国"],
  },
  {
    key: "korea",
    iso: "KR",
    label: "Korea",
    localLabel: "韓國",
    city: "Seoul",
    country: "South Korea",
    lat: 36.5,
    lng: 127.8,
    globeHeight: 1700000,
    mapZoom: 7,
    aliases: ["kr", "south korea", "republic of korea", "seoul", "韓國", "韩国", "首爾", "首尔"],
  },
];

const WORLD_COUNTRY_CENTERS = [
  ["AD", "Andorra", 42.5063, 1.5218], ["AE", "United Arab Emirates", 23.4241, 53.8478],
  ["AF", "Afghanistan", 33.9391, 67.71], ["AG", "Antigua and Barbuda", 17.0608, -61.7964],
  ["AI", "Anguilla", 18.2206, -63.0686], ["AL", "Albania", 41.1533, 20.1683],
  ["AM", "Armenia", 40.0691, 45.0382], ["AO", "Angola", -11.2027, 17.8739],
  ["AR", "Argentina", -38.4161, -63.6167], ["AS", "American Samoa", -14.271, -170.1322],
  ["AT", "Austria", 47.5162, 14.5501], ["AU", "Australia", -25.2744, 133.7751],
  ["AW", "Aruba", 12.5211, -69.9683], ["AX", "Aland Islands", 60.1785, 19.9156],
  ["AZ", "Azerbaijan", 40.1431, 47.5769], ["BA", "Bosnia and Herzegovina", 43.9159, 17.6791],
  ["BB", "Barbados", 13.1939, -59.5432], ["BD", "Bangladesh", 23.685, 90.3563],
  ["BE", "Belgium", 50.5039, 4.4699], ["BF", "Burkina Faso", 12.2383, -1.5616],
  ["BG", "Bulgaria", 42.7339, 25.4858], ["BH", "Bahrain", 25.9304, 50.6378],
  ["BI", "Burundi", -3.3731, 29.9189], ["BJ", "Benin", 9.3077, 2.3158],
  ["BL", "Saint Barthelemy", 17.9, -62.8333], ["BM", "Bermuda", 32.3078, -64.7505],
  ["BN", "Brunei", 4.5353, 114.7277], ["BO", "Bolivia", -16.2902, -63.5887],
  ["BQ", "Caribbean Netherlands", 12.1784, -68.2385], ["BR", "Brazil", -14.235, -51.9253],
  ["BS", "Bahamas", 25.0343, -77.3963], ["BT", "Bhutan", 27.5142, 90.4336],
  ["BW", "Botswana", -22.3285, 24.6849], ["BY", "Belarus", 53.7098, 27.9534],
  ["BZ", "Belize", 17.1899, -88.4976], ["CA", "Canada", 56.1304, -106.3468],
  ["CC", "Cocos Islands", -12.1642, 96.871], ["CD", "Democratic Republic of the Congo", -4.0383, 21.7587],
  ["CF", "Central African Republic", 6.6111, 20.9394], ["CG", "Republic of the Congo", -0.228, 15.8277],
  ["CH", "Switzerland", 46.8182, 8.2275], ["CI", "Cote d'Ivoire", 7.54, -5.5471],
  ["CK", "Cook Islands", -21.2367, -159.7777], ["CL", "Chile", -35.6751, -71.543],
  ["CM", "Cameroon", 7.3697, 12.3547], ["CN", "China", 35.8617, 104.1954],
  ["CO", "Colombia", 4.5709, -74.2973], ["CR", "Costa Rica", 9.7489, -83.7534],
  ["CU", "Cuba", 21.5218, -77.7812], ["CV", "Cape Verde", 16.5388, -23.0418],
  ["CW", "Curacao", 12.1696, -68.99], ["CX", "Christmas Island", -10.4475, 105.6904],
  ["CY", "Cyprus", 35.1264, 33.4299], ["CZ", "Czechia", 49.8175, 15.473],
  ["DE", "Germany", 51.1657, 10.4515], ["DJ", "Djibouti", 11.8251, 42.5903],
  ["DK", "Denmark", 56.2639, 9.5018], ["DM", "Dominica", 15.415, -61.371],
  ["DO", "Dominican Republic", 18.7357, -70.1627], ["DZ", "Algeria", 28.0339, 1.6596],
  ["EC", "Ecuador", -1.8312, -78.1834], ["EE", "Estonia", 58.5953, 25.0136],
  ["EG", "Egypt", 26.8206, 30.8025], ["EH", "Western Sahara", 24.2155, -12.8858],
  ["ER", "Eritrea", 15.1794, 39.7823], ["ES", "Spain", 40.4637, -3.7492],
  ["ET", "Ethiopia", 9.145, 40.4897], ["FI", "Finland", 61.9241, 25.7482],
  ["FJ", "Fiji", -16.5782, 179.4144], ["FK", "Falkland Islands", -51.7963, -59.5236],
  ["FM", "Micronesia", 7.4256, 150.5508], ["FO", "Faroe Islands", 61.8926, -6.9118],
  ["FR", "France", 46.2276, 2.2137], ["GA", "Gabon", -0.8037, 11.6094],
  ["GB", "United Kingdom", 54.5, -3.4], ["GD", "Grenada", 12.1165, -61.679],
  ["GE", "Georgia", 42.3154, 43.3569], ["GF", "French Guiana", 3.9339, -53.1258],
  ["GG", "Guernsey", 49.4657, -2.5853], ["GH", "Ghana", 7.9465, -1.0232],
  ["GI", "Gibraltar", 36.1377, -5.3453], ["GL", "Greenland", 71.7069, -42.6043],
  ["GM", "Gambia", 13.4432, -15.3101], ["GN", "Guinea", 9.9456, -9.6966],
  ["GP", "Guadeloupe", 16.9959, -62.0676], ["GQ", "Equatorial Guinea", 1.6508, 10.2679],
  ["GR", "Greece", 39.0742, 21.8243], ["GT", "Guatemala", 15.7835, -90.2308],
  ["GU", "Guam", 13.4443, 144.7937], ["GW", "Guinea-Bissau", 11.8037, -15.1804],
  ["GY", "Guyana", 4.8604, -58.9302], ["HK", "Hong Kong", 22.3193, 114.1694],
  ["HN", "Honduras", 15.2, -86.2419], ["HR", "Croatia", 45.1, 15.2],
  ["HT", "Haiti", 18.9712, -72.2852], ["HU", "Hungary", 47.1625, 19.5033],
  ["ID", "Indonesia", -0.7893, 113.9213], ["IE", "Ireland", 53.4129, -8.2439],
  ["IL", "Israel", 31.0461, 34.8516], ["IM", "Isle of Man", 54.2361, -4.5481],
  ["IN", "India", 20.5937, 78.9629], ["IO", "British Indian Ocean Territory", -6.3432, 71.8765],
  ["IQ", "Iraq", 33.2232, 43.6793], ["IR", "Iran", 32.4279, 53.688],
  ["IS", "Iceland", 64.9631, -19.0208], ["IT", "Italy", 41.8719, 12.5674],
  ["JE", "Jersey", 49.2144, -2.1313], ["JM", "Jamaica", 18.1096, -77.2975],
  ["JO", "Jordan", 30.5852, 36.2384], ["KE", "Kenya", -0.0236, 37.9062],
  ["KG", "Kyrgyzstan", 41.2044, 74.7661], ["KH", "Cambodia", 12.5657, 104.991],
  ["KI", "Kiribati", -3.3704, -168.734], ["KM", "Comoros", -11.875, 43.8722],
  ["KN", "Saint Kitts and Nevis", 17.3578, -62.783], ["KP", "North Korea", 40.3399, 127.5101],
  ["KR", "South Korea", 36.5, 127.8], ["KW", "Kuwait", 29.3117, 47.4818],
  ["KY", "Cayman Islands", 19.3133, -81.2546], ["KZ", "Kazakhstan", 48.0196, 66.9237],
  ["LA", "Laos", 19.8563, 102.4955], ["LB", "Lebanon", 33.8547, 35.8623],
  ["LC", "Saint Lucia", 13.9094, -60.9789], ["LI", "Liechtenstein", 47.166, 9.5554],
  ["LK", "Sri Lanka", 7.8731, 80.7718], ["LR", "Liberia", 6.4281, -9.4295],
  ["LS", "Lesotho", -29.61, 28.2336], ["LT", "Lithuania", 55.1694, 23.8813],
  ["LU", "Luxembourg", 49.8153, 6.1296], ["LV", "Latvia", 56.8796, 24.6032],
  ["LY", "Libya", 26.3351, 17.2283], ["MA", "Morocco", 31.7917, -7.0926],
  ["MC", "Monaco", 43.7384, 7.4246], ["MD", "Moldova", 47.4116, 28.3699],
  ["ME", "Montenegro", 42.7087, 19.3744], ["MF", "Saint Martin", 18.0708, -63.0501],
  ["MG", "Madagascar", -18.7669, 46.8691], ["MH", "Marshall Islands", 7.1315, 171.1845],
  ["MK", "North Macedonia", 41.6086, 21.7453], ["ML", "Mali", 17.5707, -3.9962],
  ["MM", "Myanmar", 21.9162, 95.956], ["MN", "Mongolia", 46.8625, 103.8467],
  ["MO", "Macao", 22.1987, 113.5439], ["MP", "Northern Mariana Islands", 17.3308, 145.3847],
  ["MQ", "Martinique", 14.6415, -61.0242], ["MR", "Mauritania", 21.0079, -10.9408],
  ["MS", "Montserrat", 16.7425, -62.1874], ["MT", "Malta", 35.9375, 14.3754],
  ["MU", "Mauritius", -20.3484, 57.5522], ["MV", "Maldives", 3.2028, 73.2207],
  ["MW", "Malawi", -13.2543, 34.3015], ["MX", "Mexico", 23.6345, -102.5528],
  ["MY", "Malaysia", 4.2105, 101.9758], ["MZ", "Mozambique", -18.6657, 35.5296],
  ["NA", "Namibia", -22.9576, 18.4904], ["NC", "New Caledonia", -20.9043, 165.618],
  ["NE", "Niger", 17.6078, 8.0817], ["NF", "Norfolk Island", -29.0408, 167.9547],
  ["NG", "Nigeria", 9.082, 8.6753], ["NI", "Nicaragua", 12.8654, -85.2072],
  ["NL", "Netherlands", 52.1326, 5.2913], ["NO", "Norway", 60.472, 8.4689],
  ["NP", "Nepal", 28.3949, 84.124], ["NR", "Nauru", -0.5228, 166.9315],
  ["NU", "Niue", -19.0544, -169.8672], ["NZ", "New Zealand", -40.9006, 174.886],
  ["OM", "Oman", 21.5126, 55.9233], ["PA", "Panama", 8.538, -80.7821],
  ["PE", "Peru", -9.19, -75.0152], ["PF", "French Polynesia", -17.6797, -149.4068],
  ["PG", "Papua New Guinea", -6.315, 143.9555], ["PH", "Philippines", 12.8797, 121.774],
  ["PK", "Pakistan", 30.3753, 69.3451], ["PL", "Poland", 51.9194, 19.1451],
  ["PM", "Saint Pierre and Miquelon", 46.9419, -56.2711], ["PN", "Pitcairn Islands", -24.7036, -127.4393],
  ["PR", "Puerto Rico", 18.2208, -66.5901], ["PS", "Palestine", 31.9522, 35.2332],
  ["PT", "Portugal", 39.3999, -8.2245], ["PW", "Palau", 7.515, 134.5825],
  ["PY", "Paraguay", -23.4425, -58.4438], ["QA", "Qatar", 25.3548, 51.1839],
  ["RE", "Reunion", -21.1151, 55.5364], ["RO", "Romania", 45.9432, 24.9668],
  ["RS", "Serbia", 44.0165, 21.0059], ["RU", "Russia", 61.524, 105.3188],
  ["RW", "Rwanda", -1.9403, 29.8739], ["SA", "Saudi Arabia", 23.8859, 45.0792],
  ["SB", "Solomon Islands", -9.6457, 160.1562], ["SC", "Seychelles", -4.6796, 55.492],
  ["SD", "Sudan", 12.8628, 30.2176], ["SE", "Sweden", 60.1282, 18.6435],
  ["SG", "Singapore", 1.3521, 103.8198], ["SH", "Saint Helena", -24.1435, -10.0307],
  ["SI", "Slovenia", 46.1512, 14.9955], ["SJ", "Svalbard and Jan Mayen", 77.5536, 23.6703],
  ["SK", "Slovakia", 48.669, 19.699], ["SL", "Sierra Leone", 8.4606, -11.7799],
  ["SM", "San Marino", 43.9424, 12.4578], ["SN", "Senegal", 14.4974, -14.4524],
  ["SO", "Somalia", 5.1521, 46.1996], ["SR", "Suriname", 3.9193, -56.0278],
  ["SS", "South Sudan", 6.877, 31.307], ["ST", "Sao Tome and Principe", 0.1864, 6.6131],
  ["SV", "El Salvador", 13.7942, -88.8965], ["SX", "Sint Maarten", 18.0425, -63.0548],
  ["SY", "Syria", 34.8021, 38.9968], ["SZ", "Eswatini", -26.5225, 31.4659],
  ["TC", "Turks and Caicos Islands", 21.694, -71.7979], ["TD", "Chad", 15.4542, 18.7322],
  ["TG", "Togo", 8.6195, 0.8248], ["TH", "Thailand", 15.87, 100.9925],
  ["TJ", "Tajikistan", 38.861, 71.2761], ["TK", "Tokelau", -8.9674, -171.8559],
  ["TL", "Timor-Leste", -8.8742, 125.7275], ["TM", "Turkmenistan", 38.9697, 59.5563],
  ["TN", "Tunisia", 33.8869, 9.5375], ["TO", "Tonga", -21.179, -175.1982],
  ["TR", "Turkey", 38.9637, 35.2433], ["TT", "Trinidad and Tobago", 10.6918, -61.2225],
  ["TV", "Tuvalu", -7.1095, 177.6493], ["TZ", "Tanzania", -6.369, 34.8888],
  ["UA", "Ukraine", 48.3794, 31.1656], ["UG", "Uganda", 1.3733, 32.2903],
  ["UY", "Uruguay", -32.5228, -55.7658], ["UZ", "Uzbekistan", 41.3775, 64.5853],
  ["VA", "Vatican City", 41.9029, 12.4534], ["VC", "Saint Vincent and the Grenadines", 12.9843, -61.2872],
  ["VE", "Venezuela", 6.4238, -66.5897], ["VG", "British Virgin Islands", 18.4207, -64.64],
  ["VI", "U.S. Virgin Islands", 18.3358, -64.8963], ["VN", "Vietnam", 14.0583, 108.2772],
  ["VU", "Vanuatu", -15.3767, 166.9592], ["WF", "Wallis and Futuna", -13.7688, -177.1561],
  ["WS", "Samoa", -13.759, -172.1046], ["XK", "Kosovo", 42.6026, 20.903],
  ["YE", "Yemen", 15.5527, 48.5164], ["YT", "Mayotte", -12.8275, 45.1662],
  ["ZA", "South Africa", -30.5595, 22.9375], ["ZM", "Zambia", -13.1339, 27.8493],
  ["ZW", "Zimbabwe", -19.0154, 29.1549],
];

const EXTRA_ALIASES = {
  BA: ["bosnia"],
  CD: ["congo kinshasa", "dr congo", "drc"],
  CG: ["congo brazzaville"],
  CI: ["ivory coast"],
  CZ: ["czech republic"],
  GB: ["uk", "britain", "england", "london", "英國", "英国", "倫敦", "伦敦"],
  HK: ["hk", "香港"],
  IR: ["persia"],
  KP: ["north korea", "dprk", "北韓", "北朝鮮", "朝鲜"],
  KR: ["korea", "south korea", "republic of korea", "韓國", "韩国"],
  LA: ["lao"],
  MO: ["macau", "澳門", "澳门"],
  MM: ["burma"],
  PS: ["palestinian territories"],
  RU: ["russian federation"],
  SZ: ["swaziland"],
  TR: ["turkiye", "turkiye republic"],
  TW: ["taiwan", "tw", "台灣", "台湾", "臺灣"],
  US: ["usa", "u.s.", "u.s.a.", "america", "united states of america", "美國", "美国"],
  VA: ["holy see"],
  VN: ["viet nam"],
};

function getLocalLabel(iso, fallback) {
  try {
    return zhRegionNames?.of(iso) || fallback;
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function estimateMapZoom(iso, lat) {
  if (["SG", "HK", "MO", "MC", "VA", "GI"].includes(iso)) return 11;
  if (["TW", "KR", "IL", "LB", "NL", "BE", "CH"].includes(iso)) return 7;
  if (Math.abs(Number(lat)) > 55) return 4;
  return 5;
}

function estimateGlobeHeight(iso) {
  if (["US", "CA", "RU", "CN", "BR", "AU"].includes(iso)) return 6200000;
  if (["SG", "HK", "MO", "MC", "VA"].includes(iso)) return 950000;
  return 2800000;
}

const generatedCountries = WORLD_COUNTRY_CENTERS.map(([iso, label, lat, lng]) => ({
  key: slugify(label),
  iso,
  label,
  localLabel: getLocalLabel(iso, label),
  city: label,
  country: label,
  lat,
  lng,
  globeHeight: estimateGlobeHeight(iso),
  mapZoom: estimateMapZoom(iso, lat),
  aliases: [iso.toLowerCase(), ...(EXTRA_ALIASES[iso] || [])],
}));

const featuredIsoCodes = new Set(FEATURED_COUNTRIES.map((country) => country.iso));

export const COUNTRY_FOCUS_OPTIONS = [
  ...FEATURED_COUNTRIES,
  ...generatedCountries.filter((country) => !featuredIsoCodes.has(country.iso)),
];

export const HOT_COUNTRY_KEYS = ["taiwan", "japan", "usa", "korea"];

export const HOT_COUNTRY_OPTIONS = HOT_COUNTRY_KEYS.map((key) =>
  COUNTRY_FOCUS_OPTIONS.find((country) => country.key === key)
).filter(Boolean);

function normalizeCountryQuery(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,'’()]/g, "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ");
}

function getSearchNames(country) {
  return [
    country.key,
    country.iso,
    country.label,
    country.localLabel,
    country.city,
    country.country,
    ...(country.aliases || []),
  ].filter(Boolean);
}

function scoreCountry(country, query) {
  const names = getSearchNames(country).map(normalizeCountryQuery);
  if (names.some((name) => name === query)) return 100;
  if (names.some((name) => name.startsWith(query))) return 70;
  if (names.some((name) => name.includes(query))) return 40;
  return 0;
}

export function findCountryFocus(value) {
  const query = normalizeCountryQuery(value);
  if (!query) return null;

  return (
    COUNTRY_FOCUS_OPTIONS.map((country) => ({ country, score: scoreCountry(country, query) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.country.label.localeCompare(b.country.label))[0]
      ?.country || null
  );
}

export function getCountrySuggestions(value, limit = 8) {
  const query = normalizeCountryQuery(value);
  if (!query) return [];

  return COUNTRY_FOCUS_OPTIONS.map((country) => ({ country, score: scoreCountry(country, query) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.country.label.localeCompare(b.country.label))
    .slice(0, limit)
    .map((result) => result.country);
}

export function countryToLocationPayload(country) {
  if (!country) return null;

  return {
    locationKey: country.key,
    locationCity: country.city,
    locationCountry: country.country,
    locationLat: Number(country.lat).toFixed(6),
    locationLng: Number(country.lng).toFixed(6),
  };
}

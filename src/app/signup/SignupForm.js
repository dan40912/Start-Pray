"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { saveAuthSession } from "@/lib/auth-storage";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import { resolveSafeNextPath } from "@/lib/redirect-target";

const initialForm = {
  fullName: "",
  username: "",
  faithTradition: "",
  country: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false
};

const COUNTRY_CATALOG = [
  { value: "台灣", english: "Taiwan", aliases: ["taiwan", "tw", "臺灣"] },
  { value: "香港", english: "Hong Kong", aliases: ["hong kong", "hk"] },
  { value: "澳門", english: "Macau", aliases: ["macau", "macao"] },
  { value: "中國", english: "China", aliases: ["china", "cn", "中國大陸", "大陆", "mainland china"] },
  { value: "新加坡", english: "Singapore", aliases: ["singapore", "sg"] },
  { value: "馬來西亞", english: "Malaysia", aliases: ["malaysia", "my"] },
  { value: "日本", english: "Japan", aliases: ["japan", "jp"] },
  { value: "韓國", english: "South Korea", aliases: ["south korea", "korea", "kr", "republic of korea"] },
  { value: "泰國", english: "Thailand", aliases: ["thailand", "th"] },
  { value: "越南", english: "Vietnam", aliases: ["vietnam", "vn"] },
  { value: "菲律賓", english: "Philippines", aliases: ["philippines", "ph"] },
  { value: "印尼", english: "Indonesia", aliases: ["indonesia", "id"] },
  { value: "汶萊", english: "Brunei", aliases: ["brunei", "bn"] },
  { value: "柬埔寨", english: "Cambodia", aliases: ["cambodia", "kh"] },
  { value: "寮國", english: "Laos", aliases: ["laos", "la"] },
  { value: "緬甸", english: "Myanmar", aliases: ["myanmar", "burma", "mm"] },
  { value: "東帝汶", english: "Timor-Leste", aliases: ["timor-leste", "east timor", "tl"] },
  { value: "印度", english: "India", aliases: ["india", "in"] },
  { value: "巴基斯坦", english: "Pakistan", aliases: ["pakistan", "pk"] },
  { value: "孟加拉", english: "Bangladesh", aliases: ["bangladesh", "bd"] },
  { value: "斯里蘭卡", english: "Sri Lanka", aliases: ["sri lanka", "lk"] },
  { value: "尼泊爾", english: "Nepal", aliases: ["nepal", "np"] },
  { value: "不丹", english: "Bhutan", aliases: ["bhutan", "bt"] },
  { value: "馬爾地夫", english: "Maldives", aliases: ["maldives", "mv"] },
  { value: "阿聯酋", english: "United Arab Emirates", aliases: ["united arab emirates", "uae", "ae"] },
  { value: "沙烏地阿拉伯", english: "Saudi Arabia", aliases: ["saudi arabia", "sa"] },
  { value: "卡達", english: "Qatar", aliases: ["qatar", "qa"] },
  { value: "科威特", english: "Kuwait", aliases: ["kuwait", "kw"] },
  { value: "阿曼", english: "Oman", aliases: ["oman", "om"] },
  { value: "巴林", english: "Bahrain", aliases: ["bahrain", "bh"] },
  { value: "以色列", english: "Israel", aliases: ["israel", "il"] },
  { value: "約旦", english: "Jordan", aliases: ["jordan", "jo"] },
  { value: "黎巴嫩", english: "Lebanon", aliases: ["lebanon", "lb"] },
  { value: "土耳其", english: "Turkiye", aliases: ["turkiye", "turkey", "tr"] },
  { value: "美國", english: "United States", aliases: ["united states", "usa", "us", "america"] },
  { value: "加拿大", english: "Canada", aliases: ["canada", "ca"] },
  { value: "墨西哥", english: "Mexico", aliases: ["mexico", "mx"] },
  { value: "巴西", english: "Brazil", aliases: ["brazil", "br"] },
  { value: "阿根廷", english: "Argentina", aliases: ["argentina", "ar"] },
  { value: "智利", english: "Chile", aliases: ["chile", "cl"] },
  { value: "哥倫比亞", english: "Colombia", aliases: ["colombia", "co"] },
  { value: "秘魯", english: "Peru", aliases: ["peru", "pe"] },
  { value: "厄瓜多", english: "Ecuador", aliases: ["ecuador", "ec"] },
  { value: "玻利維亞", english: "Bolivia", aliases: ["bolivia", "bo"] },
  { value: "巴拉圭", english: "Paraguay", aliases: ["paraguay", "py"] },
  { value: "烏拉圭", english: "Uruguay", aliases: ["uruguay", "uy"] },
  { value: "委內瑞拉", english: "Venezuela", aliases: ["venezuela", "ve"] },
  { value: "哥斯大黎加", english: "Costa Rica", aliases: ["costa rica", "cr"] },
  { value: "巴拿馬", english: "Panama", aliases: ["panama", "pa"] },
  { value: "瓜地馬拉", english: "Guatemala", aliases: ["guatemala", "gt"] },
  { value: "多明尼加", english: "Dominican Republic", aliases: ["dominican republic", "do"] },
  { value: "古巴", english: "Cuba", aliases: ["cuba", "cu"] },
  { value: "牙買加", english: "Jamaica", aliases: ["jamaica", "jm"] },
  { value: "波多黎各", english: "Puerto Rico", aliases: ["puerto rico", "pr"] },
  { value: "英國", english: "United Kingdom", aliases: ["united kingdom", "uk", "great britain", "gb"] },
  { value: "愛爾蘭", english: "Ireland", aliases: ["ireland", "ie"] },
  { value: "法國", english: "France", aliases: ["france", "fr"] },
  { value: "德國", english: "Germany", aliases: ["germany", "de"] },
  { value: "荷蘭", english: "Netherlands", aliases: ["netherlands", "holland", "nl"] },
  { value: "比利時", english: "Belgium", aliases: ["belgium", "be"] },
  { value: "盧森堡", english: "Luxembourg", aliases: ["luxembourg", "lu"] },
  { value: "瑞士", english: "Switzerland", aliases: ["switzerland", "ch"] },
  { value: "奧地利", english: "Austria", aliases: ["austria", "at"] },
  { value: "西班牙", english: "Spain", aliases: ["spain", "es"] },
  { value: "葡萄牙", english: "Portugal", aliases: ["portugal", "pt"] },
  { value: "義大利", english: "Italy", aliases: ["italy", "it"] },
  { value: "希臘", english: "Greece", aliases: ["greece", "gr"] },
  { value: "丹麥", english: "Denmark", aliases: ["denmark", "dk"] },
  { value: "挪威", english: "Norway", aliases: ["norway", "no"] },
  { value: "瑞典", english: "Sweden", aliases: ["sweden", "se"] },
  { value: "芬蘭", english: "Finland", aliases: ["finland", "fi"] },
  { value: "冰島", english: "Iceland", aliases: ["iceland", "is"] },
  { value: "波蘭", english: "Poland", aliases: ["poland", "pl"] },
  { value: "捷克", english: "Czechia", aliases: ["czech republic", "czechia", "cz"] },
  { value: "斯洛伐克", english: "Slovakia", aliases: ["slovakia", "sk"] },
  { value: "匈牙利", english: "Hungary", aliases: ["hungary", "hu"] },
  { value: "羅馬尼亞", english: "Romania", aliases: ["romania", "ro"] },
  { value: "保加利亞", english: "Bulgaria", aliases: ["bulgaria", "bg"] },
  { value: "克羅埃西亞", english: "Croatia", aliases: ["croatia", "hr"] },
  { value: "斯洛維尼亞", english: "Slovenia", aliases: ["slovenia", "si"] },
  { value: "愛沙尼亞", english: "Estonia", aliases: ["estonia", "ee"] },
  { value: "拉脫維亞", english: "Latvia", aliases: ["latvia", "lv"] },
  { value: "立陶宛", english: "Lithuania", aliases: ["lithuania", "lt"] },
  { value: "烏克蘭", english: "Ukraine", aliases: ["ukraine", "ua"] },
  { value: "俄羅斯", english: "Russia", aliases: ["russia", "ru"] },
  { value: "澳洲", english: "Australia", aliases: ["australia", "au"] },
  { value: "紐西蘭", english: "New Zealand", aliases: ["new zealand", "nz"] },
  { value: "南非", english: "South Africa", aliases: ["south africa", "za"] },
  { value: "奈及利亞", english: "Nigeria", aliases: ["nigeria", "ng"] },
  { value: "肯亞", english: "Kenya", aliases: ["kenya", "ke"] },
  { value: "坦尚尼亞", english: "Tanzania", aliases: ["tanzania", "tz"] },
  { value: "衣索比亞", english: "Ethiopia", aliases: ["ethiopia", "et"] },
  { value: "摩洛哥", english: "Morocco", aliases: ["morocco", "ma"] },
  { value: "阿爾及利亞", english: "Algeria", aliases: ["algeria", "dz"] },
  { value: "突尼西亞", english: "Tunisia", aliases: ["tunisia", "tn"] },
  { value: "埃及", english: "Egypt", aliases: ["egypt", "eg"] },
  { value: "其他", english: "Other", aliases: ["other"] }
];

const POPULAR_COUNTRIES = [
  "台灣",
  "香港",
  "中國",
  "新加坡",
  "馬來西亞",
  "日本",
  "韓國",
  "美國",
  "加拿大",
  "澳洲",
  "英國"
];

const normalizeLookupKey = (value) =>
  String(value ?? "")
    .trim()
    .normalize("NFKC")
    .toLowerCase();

const COUNTRY_LOOKUP = COUNTRY_CATALOG.reduce((map, item) => {
  map.set(normalizeLookupKey(item.value), item.value);
  map.set(normalizeLookupKey(item.english), item.value);
  item.aliases.forEach((alias) => map.set(normalizeLookupKey(alias), item.value));
  return map;
}, new Map());

function normalizeCountryInput(value) {
  const normalizedKey = normalizeLookupKey(value);
  if (!normalizedKey) {
    return "";
  }
  return COUNTRY_LOOKUP.get(normalizedKey) || String(value).trim();
}

// Returns every failing field at once (keyed by field name) instead of just the
// first one, so the user isn't stuck fixing-and-resubmitting one error at a time.
function getSignupFieldErrors(form) {
  const errors = {};

  if (!form.fullName.trim()) errors.fullName = "請填寫顯示名稱。";

  if (!form.username.trim()) {
    errors.username = "請填寫 Username。";
  } else if (!/^[a-z0-9_-]{4,}$/i.test(form.username.trim())) {
    errors.username = "Username 至少 4 碼，且只能包含英數、底線與減號。";
  }

  if (!form.email.trim()) {
    errors.email = "請填寫電子信箱。";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "請輸入有效的電子信箱。";
  }

  if (!form.password) {
    errors.password = "請輸入密碼。";
  } else if (form.password.length < 8) {
    errors.password = "密碼至少需要 8 碼。";
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = "請再次輸入密碼。";
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = "兩次輸入的密碼不一致。";
  }

  if (!form.acceptedTerms) errors.acceptedTerms = "請先閱讀並同意條款。";

  return errors;
}

const SIGNUP_FIELD_ORDER = [
  "fullName",
  "username",
  "email",
  "password",
  "confirmPassword",
  "acceptedTerms",
];

const SIGNUP_FIELD_INPUT_ID = {
  fullName: "full-name",
  username: "username",
  email: "signup-email",
  password: "signup-password",
  confirmPassword: "signup-confirm",
  acceptedTerms: "terms",
};

export default function SignupForm({ locale: localeProp = "zh-TW" }) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale).auth.signup;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const countrySuggestions = useMemo(() => {
    const keyword = normalizeLookupKey(form.country);
    if (!keyword) {
      return COUNTRY_CATALOG;
    }
    return COUNTRY_CATALOG.filter((item) => {
      if (normalizeLookupKey(item.value).includes(keyword)) {
        return true;
      }
      if (normalizeLookupKey(item.english).includes(keyword)) {
        return true;
      }
      return item.aliases.some((alias) => normalizeLookupKey(alias).includes(keyword));
    });
  }, [form.country]);

  const updateField = (field) => (event) => {
    const value = field === "acceptedTerms" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const applyCountry = (value) => {
    setForm((prev) => ({ ...prev, country: normalizeCountryInput(value) }));
  };

  const handleCountryChange = (event) => {
    setForm((prev) => ({ ...prev, country: event.target.value }));
  };

  const handleCountryBlur = () => {
    setForm((prev) => {
      const normalized = normalizeCountryInput(prev.country);
      if (normalized === prev.country) {
        return prev;
      }
      return { ...prev, country: normalized };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextPath = resolveSafeNextPath(searchParams?.get("next"), "/customer-portal");
    const normalizedUsername = String(form.username)
      .trim()
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();

    const normalizedCountry = normalizeCountryInput(form.country);
    const formToSend = { ...form, username: normalizedUsername, country: normalizedCountry };
    const errors = getSignupFieldErrors(formToSend);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const errorCount = Object.keys(errors).length;
      setStatus({
        state: "error",
        message:
          errorCount > 1
            ? `請修正以下 ${errorCount} 個欄位後再試一次。`
            : Object.values(errors)[0],
      });
      const firstInvalidField = SIGNUP_FIELD_ORDER.find((field) => errors[field]);
      const inputId = firstInvalidField ? SIGNUP_FIELD_INPUT_ID[firstInvalidField] : null;
      if (inputId && typeof document !== "undefined") {
        const target = document.getElementById(inputId);
        target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        target?.focus?.();
      }
      return;
    }

    setFieldErrors({});
    setStatus({ state: "loading", message: "" });

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToSend)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || text.unknownError);
      }

      saveAuthSession(data.user);
      setStatus({
        state: "success",
        message: nextPath === "/customer-portal" ? text.successPortal : text.successNext,
      });
      setForm(initialForm);
      setTimeout(() => {
        router.replace(nextPath);
      }, 1200);
    } catch (error) {
      setStatus({ state: "error", message: error.message });
    }
  };

  const isSubmitting = status.state === "loading";

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <span className="form-section-title">{text.basicInfo}</span>
      <div className="form-grid columns-2">
        <div className="form-group">
          <label className="form-label" htmlFor="full-name">
            {text.fullName} <span className="required-badge">{text.required}</span>
          </label>
          <input
            className={`form-control${fieldErrors.fullName ? " is-invalid" : ""}`}
            type="text"
            id="full-name"
            placeholder={text.fullNamePlaceholder}
            value={form.fullName}
            onChange={updateField("fullName")}
            autoComplete="name"
            aria-invalid={fieldErrors.fullName ? "true" : "false"}
            required
          />
          <span className={`form-helper${fieldErrors.fullName ? " form-helper--error" : ""}`}>
            {fieldErrors.fullName || text.fullNameHelper}
          </span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="username">
            {text.username} <span className="required-badge">{text.required}</span>
          </label>
          <input
            className={`form-control${fieldErrors.username ? " is-invalid" : ""}`}
            type="text"
            id="username"
            placeholder={text.usernamePlaceholder}
            value={form.username}
            onChange={updateField("username")}
            autoComplete="username"
            aria-invalid={fieldErrors.username ? "true" : "false"}
            required
          />
          <span className={`form-helper${fieldErrors.username ? " form-helper--error" : ""}`}>
            {fieldErrors.username || text.usernameHelper}
          </span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="faith">
            {text.faith} <span className="optional-badge">{text.optional}</span>
          </label>
          <select
            className="form-select"
            id="faith"
            value={form.faithTradition}
            onChange={updateField("faithTradition")}
          >
            <option value="">
              {text.faithEmpty}
            </option>
            <option value="基督徒">{text.christian}</option>
            <option value="其他信仰">{text.otherFaith}</option>
          </select>
          <span className="form-helper">{text.faithHelper}</span>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="country">
            {text.country} <span className="optional-badge">{text.optional}</span>
          </label>
          <input
            className="form-control"
            type="text"
            id="country"
            list="country-options"
            value={form.country}
            onChange={handleCountryChange}
            onBlur={handleCountryBlur}
            placeholder={text.countryPlaceholder}
            autoComplete="country-name"
          />
          <datalist id="country-options">
            {countrySuggestions.map((item) => (
              <option key={item.value} value={item.value} label={item.english} />
            ))}
          </datalist>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.55rem" }}>
            {POPULAR_COUNTRIES.map((country) => (
              <button
                key={country}
                type="button"
                className="home-explorer__suggestion-tag"
                onClick={() => applyCountry(country)}
              >
                {country}
              </button>
            ))}
          </div>
          <span className="form-helper">{text.countryHelper}</span>
        </div>
      </div>

      <span className="form-section-title">{text.accountInfo}</span>
      <p className="form-privacy-note">
        {text.privacyNote}
      </p>
      <div className="form-grid columns-2">
        <div className="form-group">
          <label className="form-label" htmlFor="signup-email">
            {text.email} <span className="required-badge">{text.required}</span>
          </label>
          <input
            className={`form-control${fieldErrors.email ? " is-invalid" : ""}`}
            type="email"
            id="signup-email"
            placeholder="you@example.com"
            value={form.email}
            onChange={updateField("email")}
            autoComplete="email"
            aria-invalid={fieldErrors.email ? "true" : "false"}
            required
          />
          {fieldErrors.email ? (
            <span className="form-helper form-helper--error">{fieldErrors.email}</span>
          ) : null}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="signup-password">
            {text.password} <span className="required-badge">{text.required}</span>
          </label>
          <input
            className={`form-control${fieldErrors.password ? " is-invalid" : ""}`}
            type={showPassword ? "text" : "password"}
            id="signup-password"
            placeholder={text.passwordPlaceholder}
            value={form.password}
            onChange={updateField("password")}
            onKeyUp={(event) => setCapsLockOn(Boolean(event.getModifierState?.("CapsLock")))}
            onBlur={() => setCapsLockOn(false)}
            autoComplete="new-password"
            aria-invalid={fieldErrors.password ? "true" : "false"}
            required
          />
          <button
            type="button"
            className="auth-inline-button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
          >
            {showPassword ? text.hidePassword : text.showPassword}
          </button>
          {capsLockOn ? <span className="form-helper form-helper--warning">{text.capsLock}</span> : null}
          {fieldErrors.password ? (
            <span className="form-helper form-helper--error">{fieldErrors.password}</span>
          ) : null}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="signup-confirm">
            {text.confirmPassword} <span className="required-badge">{text.required}</span>
          </label>
          <input
            className={`form-control${fieldErrors.confirmPassword ? " is-invalid" : ""}`}
            type={showConfirmPassword ? "text" : "password"}
            id="signup-confirm"
            placeholder={text.confirmPasswordPlaceholder}
            value={form.confirmPassword}
            onChange={updateField("confirmPassword")}
            autoComplete="new-password"
            aria-invalid={fieldErrors.confirmPassword ? "true" : "false"}
            required
          />
          <button
            type="button"
            className="auth-inline-button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-pressed={showConfirmPassword}
          >
            {showConfirmPassword ? text.hidePassword : text.showPassword}
          </button>
          {fieldErrors.confirmPassword ? (
            <span className="form-helper form-helper--error">{fieldErrors.confirmPassword}</span>
          ) : null}
        </div>
      </div>

      <div className="form-group" style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
        <input
          type="checkbox"
          id="terms"
          checked={form.acceptedTerms}
          onChange={updateField("acceptedTerms")}
          required
          style={{ marginTop: "0.35rem", width: "18px", height: "18px" }}
        />
        <label
          htmlFor="terms"
          className="form-label"
          style={{ fontWeight: 500, fontSize: "0.9rem", color: "var(--text-primary)" }}
        >
          {text.acceptedTerms} <a href={localizePath("/terms", locale)} target="_blank" rel="noreferrer">{text.terms}</a>
        </label>
      </div>
      {fieldErrors.acceptedTerms ? (
        <span className="form-helper form-helper--error">{fieldErrors.acceptedTerms}</span>
      ) : null}

      {status.message && (
        <div
          role="alert"
          style={{
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "0.75rem",
            border:
              status.state === "success"
                ? "1px solid rgba(22,101,52,0.35)"
                : "1px solid rgba(153,27,27,0.4)",
            background: status.state === "success" ? "#dcfce7" : "#fee2e2",
            color: status.state === "success" ? "#14532d" : "#7f1d1d",
            fontWeight: 700,
            lineHeight: 1.55
          }}
        >
          {status.message}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", opacity: isSubmitting ? 0.8 : 1 }}
        disabled={isSubmitting}
      >
        {isSubmitting ? text.submitting : text.submit}
      </button>
    </form>
  );
}

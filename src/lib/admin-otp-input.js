export function normalizeAdminOtpCode(code) {
  return typeof code === "string" ? code.normalize("NFKC").replace(/\s/g, "") : "";
}

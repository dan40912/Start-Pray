import TermsPage, { metadata } from "@/app/terms/page";

export { metadata };

// 頁首的平台數據每次都從資料庫讀，不能在 build 時靜態產生。
export const dynamic = "force-dynamic";

export default function EnglishTermsPage() {
  return <TermsPage />;
}

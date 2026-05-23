import OvercomerProfilePage, { dynamic, generateMetadata } from "@/app/overcomer/[slug]/page";

export { dynamic, generateMetadata };

export default function EnglishOvercomerProfilePage(props) {
  return <OvercomerProfilePage {...props} />;
}

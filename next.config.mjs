/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net"
      }
    ]
  },
  async redirects() {
    return [
      // 「Customer Portal」是 B2B SaaS / 電商的說法，而這裡的人不是客戶，
      // 是來禱告的人。這個字會出現在分享連結、瀏覽器歷史和書籤裡。
      //
      // 舊網址已經在外面流傳，所以保留轉址。用 307 而不是 308：永久轉址會被
      // 瀏覽器硬快取，萬一要回頭就很難收拾。等這個路徑穩定一段時間再換成永久。
      {
        source: "/customer-portal",
        destination: "/me",
        permanent: false
      },
      {
        source: "/customer-portal/:path*",
        destination: "/me/:path*",
        permanent: false
      },
      {
        source: "/en/customer-portal",
        destination: "/en/me",
        permanent: false
      },
      {
        source: "/en/customer-portal/:path*",
        destination: "/en/me/:path*",
        permanent: false
      }
    ];
  }
};

export default nextConfig;

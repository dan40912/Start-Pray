"use client";

import { useEffect, useState } from "react";
import styles from "./analytics.module.css";

const number = new Intl.NumberFormat("zh-TW");
const pct = new Intl.NumberFormat("zh-TW", { style: "percent", maximumFractionDigits: 1 });
const percent = (part, total) => total ? pct.format(part / total) : "—";
const sources = {
  direct: "直接／來源不明", threads: "Threads", instagram: "Instagram", facebook: "Facebook",
  line: "LINE", search: "搜尋", church: "教會／團體", other: "其他",
};
const pages = {
  home: "首頁", wall: "禱告牆", prayer: "代禱詳情／立即禱告", create: "建立代禱",
  signup: "註冊", room: "全球禱告室", stories: "得勝者", story: "見證詳情",
};

function Metrics({ title, values }) {
  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <dl className={styles.metrics}>
        {values.map(([label, value, detail]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{typeof value === "number" ? number.format(value) : value}</dd>
            {detail ? <small>{detail}</small> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function Breakdown({ title, rows, dimension, labels, showSignup }) {
  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={title}>
        <table>
          <thead><tr>
            <th scope="col">{title}</th><th scope="col">造訪</th><th scope="col">參與率</th>
            {showSignup ? <th scope="col">註冊率</th> : null}
          </tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row[dimension]}>
              <th scope="row">{labels[row[dimension]] || "未知"}</th>
              <td>{number.format(row.sessions)}</td>
              <td>{percent(row.engaged, row.sessions)}</td>
              {showSignup ? <td>{percent(row.signups, row.guestSessions)}</td> : null}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

function Trend({ rows, today }) {
  const max = Math.max(1, ...rows.map((row) => row.sessions));
  return (
    <section className={styles.panel}>
      <h2>每日流量</h2>
      <p>按台北日期與造訪開始時間歸屬。今天仍在累計。</p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="每日流量">
        <table>
          <thead><tr><th scope="col">日期</th><th scope="col">瀏覽器</th><th scope="col">造訪</th><th scope="col">有參與的造訪</th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.day}>
              <th scope="row">{row.day}{row.day === today ? "（今日）" : ""}</th>
              <td>{number.format(row.browsers)}</td>
              <td>
                <div className={styles.barCell}>
                  <meter aria-hidden="true" min={0} max={max} value={row.sessions} />
                  {number.format(row.sessions)}
                </div>
              </td>
              <td>{number.format(row.engaged)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/analytics?days=${days}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "無法讀取分析資料。");
        if (!controller.signal.aborted) setResult({ days, retry, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ days, retry, error: error.message });
      }
    }
    load();
    return () => controller.abort();
  }, [days, retry]);

  const current = result?.days === days && result?.retry === retry ? result : null;
  const data = current?.data;
  const totals = data?.totals;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>流量與參與</h1>
          <p>看見人從哪裡來、是否願意參與，以及是否在另一天回來。</p>
        </div>
        <label>日期範圍{" "}
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>最近 7 天</option>
            <option value={30}>最近 30 天</option>
          </select>
        </label>
      </header>
      {!current ? <p role="status">正在讀取分析資料…</p> : null}
      {current?.error ? (
        <div role="alert">{current.error} <button type="button" onClick={() => setRetry(retry + 1)}>重試</button></div>
      ) : null}
      {data ? (
        <>
          <p className={styles.note}>
            {data.enabled ? "流量收集已開啟。" : "流量收集已關閉。"}
            {totals.sessions === 0 ? "所選期間沒有觀測到造訪。流量、轉化與回訪從啟用後開始累計。" : ""}
            {" "}更新於 {new Date(data.updatedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}（台北）
          </p>
          <Metrics title="流量與轉化" values={[
            ["瀏覽器", totals.browsers, "期間內去重估計"],
            ["造訪", totals.sessions, "距上次頁面瀏覽逾 30 分鐘開新造訪"],
            ["頁面瀏覽", totals.pageViews, "觀測頁面累計"],
            ["參與率", percent(totals.engaged, totals.sessions), `${totals.engaged} 次造訪有代禱、回應或「我已禱告」`],
            ["訪客註冊率", percent(totals.signups, totals.guestSessions), `${totals.signups}／${totals.guestSessions} 次未登入造訪`],
            ["訪客參與率", percent(totals.engagedGuests, totals.guestSessions), `${totals.engagedGuests}／${totals.guestSessions} 次未登入造訪`],
            ["會員參與率", percent(totals.engagedMembers, totals.memberSessions), `${totals.engagedMembers}／${totals.memberSessions} 次已登入造訪`],
          ]} />
          <Metrics title="從瀏覽到行動" values={[
            ["代禱詳情 → 禱告或回應", percent(totals.prayerConversions, totals.prayerViews), `${totals.prayerConversions}／${totals.prayerViews} 次造訪`],
            ["建立頁 → 送出公開代禱", percent(totals.createConversions, totals.createViews), `${totals.createConversions}／${totals.createViews} 次造訪`],
            ["註冊頁 → 完成註冊", percent(totals.signupConversions, totals.signupViews), `${totals.signupConversions}／${totals.signupViews} 次造訪`],
            ["點「我已禱告」", totals.prayed, "有此行動的造訪"],
            ["送出文字回應", totals.textResponses, "有此行動的造訪"],
            ["送出語音回應", totals.voiceResponses, "有此行動的造訪"],
            ["送出公開代禱", totals.created, "有此行動的造訪"],
          ]} />
          <Metrics title="回訪與陪伴" values={[
            ["跨日回訪率", percent(data.retention.returning, totals.browsers), `${data.retention.returning} 個瀏覽器在期間內至少兩天造訪`],
            ["跨日再次參與率", percent(data.retention.repeatParticipants, data.retention.participants), `${data.retention.repeatParticipants}／${data.retention.participants} 個曾參與的瀏覽器`],
            ["24 小時內收到回應", percent(data.coverage.replied, data.coverage.eligible), `${data.coverage.replied}／${data.coverage.eligible} 張已滿 24 小時、目前可見的公開代禱卡`],
          ]} />
          <p className={styles.note}>跨日參與與收到回應反映實際行為。滿意度仍需要自願回饋。瀏覽器可能重設或跨裝置使用，轉化按同次造訪是否完成兩個步驟計算，未限定順序。</p>
          {totals.sessions > 0 ? (
            <>
              <div className={styles.breakdowns}>
                <Breakdown title="流量來源" rows={data.sources} dimension="source" labels={sources} showSignup />
                <Breakdown title="入口頁" rows={data.landings} dimension="landing" labels={pages} />
              </div>
              <Trend rows={data.trend} today={data.today} />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

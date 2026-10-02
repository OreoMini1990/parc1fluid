"use client";

import { useCallback, useEffect, useState } from "react";
import { EditableTable } from "./EditableTable";
import type { FluidRow, InjectionRow } from "@/lib/rules";
import { DEFAULT_SAFETY_STOCK, INCENTIVE_CARM, INCENTIVE_SONO, incentiveAmount } from "@/lib/rules";

type Tab = "parse" | "incentive" | "inventory";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function HomeClient() {
  const [tab, setTab] = useState<Tab>("parse");
  const [rawText, setRawText] = useState("");
  const [fluids, setFluids] = useState<FluidRow[]>([]);
  const [injections, setInjections] = useState<InjectionRow[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [from, setFrom] = useState(isoDate(weekAgo));
  const [to, setTo] = useState(isoDate(today));

  const [injRows, setInjRows] = useState<InjectionRow[]>([]);
  const [fluidUsage, setFluidUsage] = useState<{ item_name: string; total_qty: number; unit: string }[]>([]);
  const [safety, setSafety] = useState<Record<string, number>>(DEFAULT_SAFETY_STOCK);

  const parse = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "파싱 실패");
      setFluids(data.fluids || []);
      setInjections(data.injections || []);
      setIgnored(data.ignored_lines || []);
      setMsg({ type: "ok", text: "파싱 완료. 표를 검수한 뒤 저장하세요." });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "오류" });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const inj = injections.map((i) => ({
        ...i,
        incentive_amount:
          i.incentive_amount && i.incentive_amount > 0
            ? i.incentive_amount
            : incentiveAmount(i.equipment),
      }));
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, fluids, injections: inj }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setMsg({
        type: "ok",
        text: `저장 완료 (batch #${data.batchId}) — 수액 ${data.savedFluids}건, 주사 ${data.savedInjections}건`,
      });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "오류" });
    } finally {
      setLoading(false);
    }
  };

  const loadReports = useCallback(async () => {
    try {
      const q = `from=${from}&to=${to}`;
      const [iRes, fRes, sRes] = await Promise.all([
        fetch(`/api/injections?${q}`),
        fetch(`/api/fluids?${q}`),
        fetch("/api/safety-stock"),
      ]);
      const iData = await iRes.json();
      const fData = await fRes.json();
      const sData = await sRes.json();
      if (iRes.ok) setInjRows(iData.rows || []);
      if (fRes.ok) setFluidUsage(fData.rows || []);
      if (sRes.ok) setSafety(sData.items || DEFAULT_SAFETY_STOCK);
    } catch {
      /* ignore */
    }
  }, [from, to]);

  useEffect(() => {
    if (tab === "incentive" || tab === "inventory") loadReports();
  }, [tab, loadReports]);

  const roomSummary = [2, 3].map((room) => {
    const sub = injRows.filter((r) => r.room_no === room);
    const total = sub.reduce((s, r) => s + (r.incentive_amount || 0), 0);
    const sCount = sub.filter((r) => r.equipment === "S").length;
    const cCount = sub.filter((r) => r.equipment === "C").length;
    return { room, count: sub.length, total, sCount, cCount };
  });

  const reorder = Object.keys({ ...safety, ...Object.fromEntries(fluidUsage.map((f) => [f.item_name, 0])) })
    .sort()
    .filter((item) => {
      const used = fluidUsage.find((f) => f.item_name === item)?.total_qty ?? 0;
      const min = safety[item] ?? 0;
      return min > 0 && used >= min;
    })
    .map((item) => ({
      item_name: item,
      period_usage: fluidUsage.find((f) => f.item_name === item)?.total_qty ?? 0,
      min_quantity: safety[item] ?? 0,
    }));

  const saveSafety = async () => {
    const res = await fetch("/api/safety-stock", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: safety }),
    });
    const data = await res.json();
    if (!res.ok) setMsg({ type: "err", text: data.error || "저장 실패" });
    else setMsg({ type: "ok", text: "안전 재고 기준 저장됨" });
  };

  return (
    <>
      <div className="tabs">
        <button type="button" className={tab === "parse" ? "active" : ""} onClick={() => setTab("parse")}>
          ① 오더 입력·검수
        </button>
        <button type="button" className={tab === "incentive" ? "active" : ""} onClick={() => setTab("incentive")}>
          ② 인센티브 정산
        </button>
        <button type="button" className={tab === "inventory" ? "active" : ""} onClick={() => setTab("inventory")}>
          ③ 재고·사용량
        </button>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {tab === "parse" && (
        <div className="card">
          <textarea
            placeholder="여러 날짜의 수액·주사 오더를 붙여넣으세요."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <div className="row-actions">
            <button type="button" className="btn" disabled={loading} onClick={parse}>
              {loading ? "분석 중…" : "오더 분석 및 파싱"}
            </button>
            {(fluids.length > 0 || injections.length > 0) && (
              <button type="button" className="btn" disabled={loading} onClick={save}>
                최종 승인 및 DB 저장
              </button>
            )}
          </div>
          {ignored.length > 0 && (
            <details style={{ marginTop: "1rem" }}>
              <summary>제외·보류 줄 ({ignored.length})</summary>
              <ul>
                {ignored.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </details>
          )}
          {(fluids.length > 0 || injections.length > 0) && (
            <>
              <h3 style={{ marginTop: "1.25rem" }}>수액·앰플</h3>
              <EditableTable
                columns={[
                  { key: "service_date", label: "날짜" },
                  { key: "item_name", label: "품목" },
                  { key: "quantity", label: "수량", type: "number" },
                  {
                    key: "unit",
                    label: "단위",
                    type: "select",
                    options: ["count", "ampoule", "bottle", "vial"],
                  },
                  { key: "status", label: "상태", type: "select", options: ["approved", "pending"] },
                  { key: "source_line", label: "원문" },
                ]}
                rows={fluids as unknown as Record<string, unknown>[]}
                onChange={(r) => setFluids(r as unknown as FluidRow[])}
              />
              <h3>주사 시술</h3>
              <EditableTable
                columns={[
                  { key: "service_date", label: "날짜" },
                  { key: "patient_name", label: "환자" },
                  { key: "equipment", label: "장비", type: "select", options: ["S", "C", ""] },
                  { key: "chart_no", label: "차트" },
                  { key: "room_no", label: "진료실", type: "number" },
                  { key: "detail", label: "상세" },
                  { key: "incentive_amount", label: "인센티브", type: "number" },
                  { key: "status", label: "상태", type: "select", options: ["approved", "pending"] },
                ]}
                rows={injections as unknown as Record<string, unknown>[]}
                onChange={(r) => setInjections(r as unknown as InjectionRow[])}
              />
            </>
          )}
        </div>
      )}

      {tab === "incentive" && (
        <div className="card">
          <p className="sub">
            S (Sono) {INCENTIVE_SONO.toLocaleString()}원 · C (C-arm) {INCENTIVE_CARM.toLocaleString()}원
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label className="field">
              시작일
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              종료일
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="button" className="btn secondary" style={{ alignSelf: "flex-end" }} onClick={loadReports}>
              조회
            </button>
          </div>
          <div className="metrics">
            {roomSummary.map((r) => (
              <div className="metric" key={r.room}>
                <span>{r.room}진료실</span>
                <strong>{r.total.toLocaleString()}원</strong>
                <small>
                  {r.count}건 · S {r.sCount} / C {r.cCount}
                </small>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table className="editable">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>환자</th>
                  <th>장비</th>
                  <th>차트</th>
                  <th>진료실</th>
                  <th>인센티브</th>
                </tr>
              </thead>
              <tbody>
                {injRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.service_date}</td>
                    <td>{r.patient_name}</td>
                    <td>{r.equipment}</td>
                    <td>{r.chart_no}</td>
                    <td>{r.room_no}</td>
                    <td>{(r.incentive_amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "inventory" && (
        <div className="card">
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label className="field">
              시작일
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              종료일
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="button" className="btn secondary" style={{ alignSelf: "flex-end" }} onClick={loadReports}>
              조회
            </button>
          </div>
          <h3>기간 소모량</h3>
          <div className="table-wrap">
            <table className="editable">
              <thead>
                <tr>
                  <th>품목</th>
                  <th>합계</th>
                  <th>단위</th>
                </tr>
              </thead>
              <tbody>
                {fluidUsage.map((f, i) => (
                  <tr key={i}>
                    <td>{f.item_name}</td>
                    <td>{f.total_qty}</td>
                    <td>{f.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>안전 재고 기준</h3>
          <EditableTable
            columns={[
              { key: "item_name", label: "품목" },
              { key: "min_quantity", label: "최소 수량", type: "number" },
            ]}
            rows={Object.entries(safety).map(([item_name, min_quantity]) => ({
              item_name,
              min_quantity,
            }))}
            onChange={(rows) => {
              const next: Record<string, number> = {};
              for (const r of rows) {
                const name = String(r.item_name || "").trim();
                if (name) next[name] = Number(r.min_quantity) || 0;
              }
              setSafety(next);
            }}
          />
          <button type="button" className="btn" onClick={saveSafety}>
            안전 재고 저장
          </button>
          <h3>발주 검토</h3>
          {reorder.length === 0 ? (
            <p className="msg info">발주 검토 대상 없음</p>
          ) : (
            <ul>
              {reorder.map((r) => (
                <li key={r.item_name}>
                  {r.item_name}: 사용 {r.period_usage} / 기준 {r.min_quantity}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

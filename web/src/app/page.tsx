import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  return (
    <main>
      <h1>병원 수액·주사 오더 관리</h1>
      <p className="sub">Vercel 배포 · Google Sheets 저장 · LLM 파싱 후 표에서 검수</p>
      <HomeClient />
    </main>
  );
}

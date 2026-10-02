from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

from config.settings import DATABASE_PATH, resolve_llm_provider
from db.schema import init_db
from ui.tab_incentive import render_tab_incentive
from ui.tab_inventory import render_tab_inventory
from ui.tab_parse import render_tab_parse


def main() -> None:
    st.set_page_config(
        page_title="병원 오더 · 인센티브 · 재고",
        page_icon="🏥",
        layout="wide",
    )
    init_db(DATABASE_PATH)

    st.title("병원 수액·주사 오더 관리")
    st.caption("입력은 텍스트 · 검수는 표 · 저장은 승인 후 DB")

    provider = resolve_llm_provider()
    if provider:
        st.sidebar.success(f"LLM: {provider}")
    else:
        st.sidebar.warning("LLM API 키 미설정 — 파싱 불가")
    st.sidebar.text(f"DB: {DATABASE_PATH}")

    tab1, tab2, tab3 = st.tabs(
        [
            "① 오더 입력·검수",
            "② 인센티브 정산",
            "③ 재고·사용량",
        ]
    )
    with tab1:
        render_tab_parse()
    with tab2:
        render_tab_incentive()
    with tab3:
        render_tab_inventory()


if __name__ == "__main__":
    main()

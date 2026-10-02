from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import streamlit as st

from db.repository import (
    fetch_fluid_usage,
    get_safety_stock,
    reorder_candidates,
    upsert_safety_stock,
)


def render_tab_inventory() -> None:
    st.subheader("수액 재고 및 사용량")
    st.caption("기간별 소모량 집계 · 안전 재고 대비 발주 검토 품목")

    today = date.today()
    default_from = today - timedelta(days=7)
    c1, c2 = st.columns(2)
    with c1:
        d_from = st.date_input("시작일", value=default_from, key="inv_from")
    with c2:
        d_to = st.date_input("종료일", value=today, key="inv_to")

    usage = fetch_fluid_usage(
        date_from=d_from.isoformat(),
        date_to=d_to.isoformat(),
    )

    st.markdown("#### 기간별 품목 소모량")
    if usage.empty:
        st.info("해당 기간 사용 기록이 없습니다.")
    else:
        st.dataframe(usage, use_container_width=True, hide_index=True)

    safety = get_safety_stock()
    st.markdown("#### 안전 재고 기준 (수정 가능)")
    safety_df = pd.DataFrame(
        [{"item_name": k, "min_quantity": v} for k, v in sorted(safety.items())]
    )
    edited = st.data_editor(
        safety_df,
        column_config={
            "item_name": st.column_config.TextColumn("품목"),
            "min_quantity": st.column_config.NumberColumn("최소 수량", min_value=0.0, step=1.0),
        },
        num_rows="dynamic",
        use_container_width=True,
        key="safety_editor",
    )
    if st.button("안전 재고 기준 저장"):
        for _, row in edited.iterrows():
            name = str(row.get("item_name") or "").strip()
            if not name:
                continue
            upsert_safety_stock(name, float(row.get("min_quantity") or 0))
        st.success("안전 재고 기준이 저장되었습니다.")
        st.rerun()

    safety_map = get_safety_stock()
    reorder = reorder_candidates(usage, safety_map)
    st.markdown("#### 발주 검토 품목")
    if reorder.empty:
        st.success("현재 기준으로 즉시 발주가 필요한 품목이 없습니다.")
    else:
        st.warning("아래 품목은 기간 사용량이 안전 재고 기준 이상입니다.")
        st.dataframe(reorder, use_container_width=True, hide_index=True)

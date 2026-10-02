from __future__ import annotations

from datetime import date, timedelta

import streamlit as st

from config.settings import INCENTIVE_CARM, INCENTIVE_SONO
from db.repository import fetch_injections, incentive_summary_by_room


def render_tab_incentive() -> None:
    st.subheader("주사 인센티브 정산")
    st.caption(f"S (Sono) = {INCENTIVE_SONO:,}원 · C (C-arm) = {INCENTIVE_CARM:,}원")

    today = date.today()
    default_from = today - timedelta(days=7)
    c1, c2 = st.columns(2)
    with c1:
        d_from = st.date_input("시작일", value=default_from, key="inc_from")
    with c2:
        d_to = st.date_input("종료일", value=today, key="inc_to")

    df = fetch_injections(
        date_from=d_from.isoformat(),
        date_to=d_to.isoformat(),
    )

    if df.empty:
        st.info("해당 기간 저장된 시술 내역이 없습니다.")
        return

    st.markdown("#### 진료실별 집계")
    summary = incentive_summary_by_room(df)
    focus = summary[summary["room_no"].isin([2, 3])] if not summary.empty else summary
    if focus.empty and not summary.empty:
        focus = summary
    st.dataframe(focus, use_container_width=True, hide_index=True)

    if not focus.empty:
        for _, row in focus.iterrows():
            room = int(row["room_no"])
            if room in (2, 3):
                st.metric(
                    label=f"{room}진료실 인센티브 합계",
                    value=f"{int(row['total_incentive']):,}원",
                    delta=f"S {int(row['S_count'])}건 / C {int(row['C_count'])}건",
                )

    st.markdown("#### 환자별·날짜별 상세")
    show = df[
        [
            "service_date",
            "patient_name",
            "equipment",
            "chart_no",
            "room_no",
            "detail",
            "incentive_amount",
        ]
    ].copy()
    st.dataframe(show, use_container_width=True, hide_index=True)

    total = int(df["incentive_amount"].sum())
    st.metric("기간 전체 인센티브 합계", f"{total:,}원")

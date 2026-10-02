from __future__ import annotations

import streamlit as st

from db.repository import save_approved_batch
from services.llm_client import LLMNotConfiguredError
from services.parser_service import (
    dataframe_to_fluids,
    dataframe_to_injections,
    fluids_to_dataframe,
    injections_to_dataframe,
    parse_order_text,
)


def render_tab_parse() -> None:
    st.subheader("오더 입력 및 파싱 검수")
    st.caption("텍스트로 붙여넣기 → LLM 파싱 → 표에서 수정 → 승인 후에만 DB 저장")

    raw = st.text_area(
        "오더 원문",
        height=220,
        placeholder="여러 날짜의 수액·주사 오더를 통째로 붙여넣으세요.",
        key="order_raw_text",
    )

    col1, _ = st.columns([1, 3])
    with col1:
        analyze = st.button("오더 분석 및 파싱", type="primary", use_container_width=True)

    if analyze:
        if not raw.strip():
            st.warning("오더 텍스트를 입력해 주세요.")
        else:
            with st.spinner("LLM이 오더를 분석 중입니다…"):
                try:
                    result = parse_order_text(raw)
                except LLMNotConfiguredError as e:
                    st.error(str(e))
                    st.info(".env.example을 참고해 API 키를 설정하세요.")
                    return

            if result.get("error"):
                st.error(f"파싱 오류: {result['error']}")
                return

            st.session_state["parse_result"] = result
            st.session_state["parse_raw_text"] = raw
            st.session_state["fluids_df"] = fluids_to_dataframe(result.get("fluids") or [])
            st.session_state["injections_df"] = injections_to_dataframe(
                result.get("injections") or []
            )
            st.success("파싱 완료. 아래 표를 검수·수정한 뒤 저장하세요.")

    result = st.session_state.get("parse_result")
    if not result:
        return

    ignored = result.get("ignored_lines") or []
    if ignored:
        with st.expander("제외·보류 처리된 줄", expanded=False):
            for line in ignored:
                st.text(f"• {line}")

    st.markdown("#### 수액·앰플 (재고)")
    fluid_config = {
        "service_date": st.column_config.TextColumn("날짜", width="small"),
        "item_name": st.column_config.TextColumn("품목", width="medium"),
        "quantity": st.column_config.NumberColumn("수량", min_value=0.0, step=0.5),
        "unit": st.column_config.SelectboxColumn(
            "단위", options=["count", "ampoule", "bottle", "vial"]
        ),
        "status": st.column_config.SelectboxColumn(
            "상태", options=["approved", "pending"]
        ),
        "source_line": st.column_config.TextColumn("원문", width="large"),
    }
    edited_fluids = st.data_editor(
        st.session_state.get("fluids_df"),
        column_config=fluid_config,
        num_rows="dynamic",
        use_container_width=True,
        key="fluid_editor",
    )
    st.session_state["fluids_df"] = edited_fluids

    st.markdown("#### 주사 시술 (인센티브)")
    inj_config = {
        "service_date": st.column_config.TextColumn("날짜"),
        "patient_name": st.column_config.TextColumn("환자"),
        "equipment": st.column_config.SelectboxColumn("장비", options=["S", "C", ""]),
        "chart_no": st.column_config.TextColumn("차트번호"),
        "room_no": st.column_config.NumberColumn("진료실", min_value=1, max_value=9, step=1),
        "detail": st.column_config.TextColumn("시술 상세"),
        "incentive_amount": st.column_config.NumberColumn("인센티브(원)", min_value=0, step=1000),
        "status": st.column_config.SelectboxColumn(
            "상태", options=["approved", "pending"]
        ),
    }
    edited_inj = st.data_editor(
        st.session_state.get("injections_df"),
        column_config=inj_config,
        num_rows="dynamic",
        use_container_width=True,
        key="injection_editor",
    )
    st.session_state["injections_df"] = edited_inj

    if st.button("최종 승인 및 DB 저장", type="primary"):
        fluids = dataframe_to_fluids(edited_fluids)
        injections = dataframe_to_injections(edited_inj)
        approved_f = [x for x in fluids if x.get("status") != "pending"]
        approved_i = [x for x in injections if x.get("status") != "pending"]
        batch_id = save_approved_batch(
            st.session_state.get("parse_raw_text", ""),
            fluids,
            injections,
        )
        st.success(
            f"저장 완료 (batch #{batch_id}). "
            f"승인 수액 {len(approved_f)}건, 주사 {len(approved_i)}건 "
            f"(pending은 DB 제외)."
        )

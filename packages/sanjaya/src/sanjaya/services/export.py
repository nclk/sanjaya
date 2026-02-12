"""Server-driven export — CSV and XLSX rendering for flat and pivot data."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator
from typing import Any

from django.http import StreamingHttpResponse

from sanjaya_core import DataProvider
from sanjaya_core.context import RequestContext
from sanjaya_core.enums import AggFunc, ExportFormat, SortDirection
from sanjaya_core.types import (
    AggregateResult,
    SortSpec,
    TabularResult,
    ValueSpec,
)

from sanjaya.schemas.export import ExportRequest
from sanjaya.schemas.filters import parse_ag_grid_filter_model, parse_filter_group


def handle_export(
    provider: DataProvider,
    request: ExportRequest,
    *,
    ctx: RequestContext | None = None,
) -> StreamingHttpResponse:
    """Produce a streaming CSV or XLSX response."""
    if request.flat is not None:
        return _flat_export(provider, request, ctx=ctx)
    elif request.pivot is not None:
        return _pivot_export(provider, request, ctx=ctx)
    else:
        raise ValueError("Export request must specify either 'flat' or 'pivot'.")


# ---------------------------------------------------------------------------
# Flat export
# ---------------------------------------------------------------------------


def _flat_export(
    provider: DataProvider,
    request: ExportRequest,
    *,
    ctx: RequestContext | None = None,
) -> StreamingHttpResponse:
    flat = request.flat
    assert flat is not None

    filter_group = parse_filter_group(flat.filter)
    result: TabularResult = provider.query(
        flat.selected_columns,
        filter_group=filter_group,
        limit=0,  # 0 = no limit — fetch everything
        offset=0,
        ctx=ctx,
    )

    if flat.format == ExportFormat.CSV:
        return _render_csv(result.columns, result.rows, filename="export.csv")
    else:
        return _render_xlsx(result.columns, result.rows, filename="export.xlsx")


# ---------------------------------------------------------------------------
# Pivot export
# ---------------------------------------------------------------------------


def _pivot_export(
    provider: DataProvider,
    request: ExportRequest,
    *,
    ctx: RequestContext | None = None,
) -> StreamingHttpResponse:
    pivot = request.pivot
    assert pivot is not None

    filter_group = parse_ag_grid_filter_model(pivot.filter_model)
    group_by_rows = [c.field or c.id for c in pivot.row_group_cols]
    group_by_cols = [c.field or c.id for c in pivot.pivot_cols]
    values = [
        ValueSpec(
            column=c.field or c.id,
            agg=c.agg_func or AggFunc.SUM,
            label=c.display_name,
        )
        for c in pivot.value_cols
    ]

    sort: list[SortSpec] | None = None
    if pivot.sort_model:
        sort = [
            SortSpec(
                column=s.col_id,
                direction=SortDirection.DESC if s.sort == "desc" else SortDirection.ASC,
            )
            for s in pivot.sort_model
        ]

    agg_result: AggregateResult = provider.aggregate(
        group_by_rows=group_by_rows,
        group_by_cols=group_by_cols,
        values=values,
        filter_group=filter_group,
        sort=sort,
        limit=None,  # full result for export
        offset=0,
        ctx=ctx,
    )

    # Build human-readable cross-tab headers from AggregateColumn metadata.
    headers: list[str] = []
    col_keys: list[str] = []
    for col in agg_result.columns:
        if col.pivot_keys:
            header = " › ".join(col.pivot_keys)
            if col.measure:
                header += f" ({col.agg or col.measure})"
        else:
            header = col.header
        headers.append(header)
        col_keys.append(col.key)

    rows_for_export = [
        {h: row.get(k) for h, k in zip(headers, col_keys)}
        for row in agg_result.rows
    ]

    if pivot.format == ExportFormat.CSV:
        return _render_csv(headers, rows_for_export, filename="pivot_export.csv")
    else:
        return _render_xlsx(headers, rows_for_export, filename="pivot_export.xlsx")


# ---------------------------------------------------------------------------
# Renderers
# ---------------------------------------------------------------------------


def _render_csv(
    columns: list[str],
    rows: list[dict[str, Any]],
    *,
    filename: str,
) -> StreamingHttpResponse:
    def _generate() -> Iterator[bytes]:
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=columns)
        writer.writeheader()
        yield buf.getvalue().encode()
        buf.seek(0)
        buf.truncate(0)

        for row in rows:
            writer.writerow({c: row.get(c, "") for c in columns})
            yield buf.getvalue().encode()
            buf.seek(0)
            buf.truncate(0)

    response = StreamingHttpResponse(
        _generate(),
        content_type="text/csv",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _render_xlsx(
    columns: list[str],
    rows: list[dict[str, Any]],
    *,
    filename: str,
) -> StreamingHttpResponse:
    from openpyxl import Workbook

    wb = Workbook(write_only=True)
    ws = wb.create_sheet()
    ws.append(columns)
    for row in rows:
        ws.append([row.get(c) for c in columns])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    response = StreamingHttpResponse(
        buf,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response

import os

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .db import Record, RecordVersion, RunLog, ScrapeRun, Source, make_session_factory
from .pipeline import SourceInput, execute


class SourcePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = None
    kind: str | None = None
    url: str | None = None
    config: dict | None = None
    enabled: bool | None = None


def create_app(database_url=None, fetcher=None):
    factory = make_session_factory(database_url or os.getenv("SCRAPEFLOW_DATABASE_URL", "sqlite:///scrapeflow.db"))
    app = FastAPI(title="ScrapeFlow")

    def db():
        with factory() as session:
            yield session

    def require(session, model, id):
        obj = session.get(model, id)
        if obj is None:
            raise HTTPException(404, "Not found")
        return obj

    def page(session, query, limit, offset):
        total = session.scalar(select(func.count()).select_from(query.subquery()))
        rows = session.scalars(query.limit(limit).offset(offset)).all()
        return {"items": rows, "total": total, "limit": limit, "offset": offset}

    def source_out(x):
        return {"id": x.id, "name": x.name, "kind": x.kind, "url": x.url, "config": x.config_json, "enabled": x.enabled, "created_at": x.created_at, "updated_at": x.updated_at}

    def run_out(x):
        return {key: getattr(x, key) for key in ("id", "source_id", "status", "started_at", "finished_at", "fetched_count", "extracted_count", "created_count", "updated_count", "unchanged_count", "error_count")}

    def record_out(x):
        return {key: getattr(x, key) for key in ("id", "source_id", "external_id", "title", "url", "current_version_id", "first_seen_at", "last_seen_at")}

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/v1/sources", status_code=201)
    def add_source(body: SourceInput, session=Depends(db)):
        source = Source(name=body.name, kind=body.kind, url=body.url, config_json=body.config, enabled=body.enabled)
        session.add(source)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, "Source name already exists")
        return source_out(source)

    @app.get("/api/v1/sources")
    def sources(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), session=Depends(db)):
        result = page(session, select(Source).order_by(Source.id), limit, offset)
        result["items"] = [source_out(x) for x in result["items"]]
        return result

    @app.get("/api/v1/sources/{source_id}")
    def get_source(source_id: int, session=Depends(db)):
        return source_out(require(session, Source, source_id))

    @app.patch("/api/v1/sources/{source_id}")
    def patch_source(source_id: int, body: SourcePatch, session=Depends(db)):
        source = require(session, Source, source_id)
        combined = {"name": source.name, "kind": source.kind, "url": source.url, "config": source.config_json, "enabled": source.enabled}
        combined.update(body.model_dump(exclude_unset=True))
        try:
            validated = SourceInput.model_validate(combined)
        except ValidationError as exc:
            raise HTTPException(422, exc.errors(include_context=False)) from exc
        source.name, source.kind, source.url, source.config_json, source.enabled = validated.name, validated.kind, validated.url, validated.config, validated.enabled
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, "Source name already exists")
        return source_out(source)

    @app.delete("/api/v1/sources/{source_id}", status_code=204)
    def delete_source(source_id: int, session=Depends(db)):
        source = require(session, Source, source_id)
        if session.scalar(select(func.count()).select_from(ScrapeRun).where(ScrapeRun.source_id == source_id)) or session.scalar(select(func.count()).select_from(Record).where(Record.source_id == source_id)):
            raise HTTPException(409, "Source has history; retain it for auditability")
        session.delete(source)
        session.commit()

    @app.post("/api/v1/sources/{source_id}/runs")
    def run_source(source_id: int, session=Depends(db)):
        source = require(session, Source, source_id)
        if not source.enabled:
            raise HTTPException(409, "Source is disabled")
        return run_out(execute(session, source, fetcher) if fetcher else execute(session, source))

    @app.get("/api/v1/runs")
    def runs(source_id: int | None = None, status: str | None = None, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), session=Depends(db)):
        query = select(ScrapeRun)
        if source_id is not None:
            query = query.where(ScrapeRun.source_id == source_id)
        if status is not None:
            query = query.where(ScrapeRun.status == status)
        result = page(session, query.order_by(ScrapeRun.id.desc()), limit, offset)
        result["items"] = [run_out(x) for x in result["items"]]
        return result

    @app.get("/api/v1/runs/{run_id}")
    def get_run(run_id: int, session=Depends(db)):
        return run_out(require(session, ScrapeRun, run_id))

    @app.get("/api/v1/runs/{run_id}/logs")
    def logs(run_id: int, session=Depends(db)):
        require(session, ScrapeRun, run_id)
        return [{"id": x.id, "timestamp": x.timestamp, "stage": x.stage, "level": x.level, "message": x.message} for x in session.scalars(select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.id))]

    @app.get("/api/v1/records")
    def records(source_id: int | None = None, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), session=Depends(db)):
        query = select(Record)
        if source_id is not None:
            query = query.where(Record.source_id == source_id)
        result = page(session, query.order_by(Record.id), limit, offset)
        result["items"] = [record_out(x) for x in result["items"]]
        return result

    @app.get("/api/v1/records/{record_id}")
    def get_record(record_id: int, session=Depends(db)):
        return record_out(require(session, Record, record_id))

    @app.get("/api/v1/records/{record_id}/versions")
    def versions(record_id: int, session=Depends(db)):
        require(session, Record, record_id)
        return [{"id": x.id, "record_id": x.record_id, "content_hash": x.content_hash, "payload": x.payload_json, "captured_at": x.captured_at, "run_id": x.run_id} for x in session.scalars(select(RecordVersion).where(RecordVersion.record_id == record_id).order_by(RecordVersion.id.desc()))]

    @app.get("/api/v1/stats")
    def stats(session=Depends(db)):
        return {"sources": session.scalar(select(func.count()).select_from(Source)), "records": session.scalar(select(func.count()).select_from(Record)), "versions": session.scalar(select(func.count()).select_from(RecordVersion)), "runs": session.scalar(select(func.count()).select_from(ScrapeRun)), "recent_runs": [run_out(x) for x in session.scalars(select(ScrapeRun).order_by(ScrapeRun.id.desc()).limit(5))]}

    return app


app = create_app()


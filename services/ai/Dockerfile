# syntax=docker/dockerfile:1
FROM python:3.11-alpine

WORKDIR /app

RUN addgroup -S -g 1001 skynav && adduser -S -u 1001 -G skynav skynav

COPY pyproject.toml ./
COPY skynav_ai/ ./skynav_ai/

USER skynav

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV AI_HOST=0.0.0.0
ENV AI_PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["python", "-m", "skynav_ai.server"]

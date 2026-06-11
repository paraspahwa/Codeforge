FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

ARG RTK_VERSION=0.42.3
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && ARCH="$(uname -m)" \
    && case "$ARCH" in x86_64) RTK_ARCH="x86_64-unknown-linux-musl" ;; aarch64|arm64) RTK_ARCH="aarch64-unknown-linux-gnu" ;; *) RTK_ARCH="x86_64-unknown-linux-musl" ;; esac \
    && curl -fsSL "https://github.com/rtk-ai/rtk/releases/download/v${RTK_VERSION}/rtk-${RTK_ARCH}.tar.gz" -o /tmp/rtk.tar.gz \
    && tar -xzf /tmp/rtk.tar.gz -C /usr/local/bin rtk \
    && chmod +x /usr/local/bin/rtk \
    && rm -rf /var/lib/apt/lists/* /tmp/rtk.tar.gz \
    || echo "rtk install skipped"

COPY app /app/app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

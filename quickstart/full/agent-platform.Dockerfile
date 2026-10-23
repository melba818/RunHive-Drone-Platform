FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/srv/agent/platform:/srv/agent/source
WORKDIR /srv/agent
COPY services/agent-platform/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY services/agent-platform /srv/agent/platform
COPY agent-platform-source /srv/agent/source
WORKDIR /srv/agent/source
CMD ["python", "serve.py"]

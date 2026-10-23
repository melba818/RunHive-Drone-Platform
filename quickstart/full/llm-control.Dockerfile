FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/runtime
RUN pip install --no-cache-dir fastapi uvicorn httpx pyyaml python-multipart jsonschema pillow
COPY services/llm-center/runtime /opt/runtime
CMD ["python", "/opt/runtime/control.py"]

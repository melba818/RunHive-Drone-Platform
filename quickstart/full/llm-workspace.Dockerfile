FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/runtime
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "fastapi>=0.110" "uvicorn>=0.29" "httpx>=0.27" "pyyaml>=6.0" "python-multipart>=0.0.9" "jsonschema>=4.0" "gradio>=4.0" "llamafactory" "pillow>=10.0" "pyarrow==17.0.0" "transformers==4.45.2"
COPY services/llm-center/runtime /opt/runtime
RUN python -c "from llamafactory.train.tuner import run_exp; import gradio; print('workspace deps ok')"
CMD ["python", "/opt/runtime/ui.py"]

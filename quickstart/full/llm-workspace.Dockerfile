FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /opt/runtime
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir "fastapi>=0.110" "uvicorn>=0.29" "httpx>=0.27" "pyyaml>=6.0" "python-multipart>=0.0.9" "jsonschema>=4.0" "gradio>=4.0" "llamafactory==0.9.5" "pillow>=10.0" "pyarrow==17.0.0"
COPY services/llm-center/runtime /opt/runtime
RUN python -c "from llamafactory.train.tuner import run_exp; from llamafactory.extras.constants import MULTIMODAL_SUPPORTED_MODELS; from llamafactory.webui.runner import Runner; from llamafactory.webui.chatter import WebChatModel; from llamafactory.webui.components import export; from llamafactory.webui.locales import LOCALES; from llamafactory.webui.engine import Engine; from llamafactory.webui.components import create_top, create_train_tab, create_eval_tab, create_infer_tab, create_export_tab, create_footer; import gradio; print('workspace deps ok')"
CMD ["python", "/opt/runtime/ui.py"]

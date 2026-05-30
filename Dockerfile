FROM python:3.12-slim
WORKDIR /srv

# Build profile selects the dependency set:
#   requirements.txt        -> Tier A (hosted; includes anthropic/openai SDKs)
#   requirements-tierb.txt  -> Tier B (on-prem/air-gapped; no cloud LLM SDKs)
# docker-compose-prod.yml builds with PIP_REQUIREMENTS=requirements-tierb.txt.
ARG PIP_REQUIREMENTS=requirements.txt
COPY requirements.txt requirements-tierb.txt ./
RUN pip install --no-cache-dir -r ${PIP_REQUIREMENTS}

COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

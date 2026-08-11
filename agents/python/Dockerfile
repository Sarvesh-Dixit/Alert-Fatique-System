FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /agent

COPY . .
RUN pip install --no-cache-dir .

# Enroll once (mounts a volume for the stored credential), then run:
#   docker compose run --rm agent th-agent enroll --endpoint http://api:8000 --device-id dev_xxx --token <tok>
#   docker compose run --rm agent th-agent run
ENTRYPOINT ["th-agent"]
CMD ["run"]

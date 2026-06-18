FROM python:3.11-alpine
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY . .
EXPOSE 8087
CMD ["python", "server.py"]

FROM python:3.11-slim
WORKDIR /work
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY models/ ./models/
COPY repack.py .
CMD ["python", "repack.py"]
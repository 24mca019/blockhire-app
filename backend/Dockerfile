# backend/Dockerfile

# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
# Changed to 'requirements-simple.txt' based on your screenshot
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the rest of the backend source code
COPY . .

# Run gunicorn
# Changed to 'blockhire.wsgi:application' based on your project structure
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "blockhire.wsgi:application"]
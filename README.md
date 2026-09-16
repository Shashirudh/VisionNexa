# VisionNexa (विज़ननेक्सा)

> **Explainable AI System for Diabetic Retinopathy Screening in Rural India**

---

## 🎯 Overview

**VisionNexa** is an AI-powered, interpretable decision support system designed to assist healthcare workers and ophthalmologists in early screening of Diabetic Retinopathy (DR) in low-resource and rural settings across India. 

The system pairs deep learning fundus image classification with **Explainable AI (Grad-CAM)** to highlight pathological regions (microaneurysms, hemorrhages, exudates), ensuring transparency and clinical trust.

---

## 📁 Project Structure

```
VisionNexa/
├── frontend/                     # React + Vite + TypeScript web interface
│   ├── public/                   # Static assets
│   ├── src/                      # React UI components and pages
│   ├── package.json              # Frontend dependencies
│   ├── tsconfig.json             # TypeScript configuration
│   └── vite.config.ts            # Vite configuration
│
├── backend/                      # Python + FastAPI backend
│   ├── app/
│   │   ├── api/                  # API endpoints and route definitions
│   │   ├── core/                 # App configurations and constants
│   │   ├── explainability/       # Grad-CAM heatmap generation module
│   │   ├── models/               # PyTorch model architecture and loader
│   │   ├── services/             # Screening and preprocessing pipeline
│   │   ├── __init__.py
│   │   └── main.py               # FastAPI application entrypoint
│   ├── weights/                  # Directory for trained PyTorch model weights (.pt / .pth)
│   │   ├── .gitkeep
│   │   └── README.md
│   ├── .env.example              # Environment variables template
│   └── requirements.txt          # Python dependencies
│
├── .gitignore                    # Root gitignore for Node, Python, weights & data
└── README.md                     # Project documentation
```

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI + PyTorch)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   Interactive API docs will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Frontend Setup (React + Vite + TypeScript)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
   The application UI will run at: [http://localhost:5173](http://localhost:5173)

---

## 🧠 Model & Explainability Integration

- **Model Weights**: Place your trained PyTorch model checkpoint (e.g., `dr_model.pth`) inside [`backend/weights/`](./backend/weights/).
- **Model Loader**: Configure the network architecture in [`backend/app/models/model_loader.py`](./backend/app/models/model_loader.py).
- **Grad-CAM Explainer**: Implement target layer hooks in [`backend/app/explainability/gradcam.py`](./backend/app/explainability/gradcam.py).

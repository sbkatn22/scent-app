# scent-app

## Backend (Django)

### Setup

1. Create and activate a virtual environment:

   ```bash
   cd ascent-backend
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   # source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

### Run the server

From the `ascent-backend` directory (with the venv activated):

```bash
python manage.py runserver
```

The app will be available at http://127.0.0.1:8000/

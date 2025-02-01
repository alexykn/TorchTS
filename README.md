# TorchTS Project

## Overview

TorchTS is a text-to-speech application built with Python and Vue.js. It provides an interface for converting text from various document formats into speech using the Kokoro TTS model. The project combines a FastAPI backend with a Vue.js frontend to create a practical tool for text-to-speech conversion.

## Features

- **Text Processing:** Text handling and chunking utilities
- **Document Support:** Parse and extract text from PDF, DOCX, ODT, and markdown files
- **Audio Generation:** Text-to-speech conversion using Kokoro TTS
- **RESTful API:** FastAPI backend endpoints for file processing and audio generation
- **Modern Interface:** Vue.js frontend with Vuetify components for a responsive design

## Project Structure

```
/Users/alxknt/Github/torchts
├── requirements.txt           # Python dependencies
├── src
│   └── torchts
│       ├── api.py            # API endpoint definitions
│       ├── audio_generator.py # Audio generation utilities
│       ├── document_parser.py # Document parsing utilities
│       ├── text_processor.py  # Text processing functionalities
│       ├── main.py           # Main entry point for backend
│       └── templates
│           └── vue           # Frontend application
```

## Installation

### Backend Setup (Python)

1. Ensure you have Python 3.7+ installed
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the backend server:
   ```bash
   python src/torchts/main.py
   ```

### Frontend Setup (Vue.js)

1. Navigate to the Vue directory:
   ```bash
   cd src/torchts/templates/vue
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```

## Usage

Access the web interface at `http://localhost:5173` after starting both the backend and frontend servers. Upload text or documents and select your preferred voice to generate speech.

## Contributing

Feel free to open issues or submit pull requests if you'd like to contribute to the project.

## License

This project is licensed under the MIT License.

## Acknowledgments

- This project relies heavily on the [Kokoro-82M](https://github.com/hexgrad/kokoro) text-to-speech model created by [hexgrad](https://huggingface.co/hexgrad/Kokoro-82M). Their work on developing this high-quality TTS model made this project possible.
- Built with FastAPI, Vue.js, and Vuetify

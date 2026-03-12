# LlamaParse PDF Extraction App

A TypeScript application that extracts structured data from PDF documents using LlamaIndex's LlamaParse service.

## Features

- Upload PDF files through a web interface
- Extract structured data using LlamaParse extraction service
- Display extracted fields with confidence scores and citations
- View raw data and metadata

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- LlamaParse API key (set as `LLAMAPARSE_API_KEY` environment variable)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with your LlamaParse API key:
```
LLAMAPARSE_API_KEY=your_api_key_here
```

Alternatively, you can set it as an environment variable:
```bash
export LLAMAPARSE_API_KEY=your_api_key_here
```

**Note:** The application uses `dotenv` to automatically load environment variables from the `.env` file.

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

The application will be available at `http://localhost:3031`

## Usage

1. Open your browser and navigate to `http://localhost:3031`
2. Click "Choose PDF File" to select a PDF document
3. Click "Upload PDF" to upload the file
4. Click "Extract Data" to start the extraction process
5. View the results in the interface:
   - **Fields**: Extracted fields with confidence scores and citations
   - **Raw Data**: Complete raw JSON response
   - **Metadata**: Extraction metadata and usage statistics

## Project Structure

```
llama-parse-app/
├── services/
│   ├── LlamaParseExtractionService.ts
│   └── LlamaParseSchemaBuilder.ts
├── public/
│   └── index.html
├── server.ts
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

- `POST /api/upload` - Upload a PDF file
- `POST /api/extract` - Extract data from the uploaded PDF
- `GET /` - Serve the frontend interface

## Notes

- The extraction process may take several minutes depending on the PDF size and complexity
- Maximum file size: 100MB
- Only PDF files are supported

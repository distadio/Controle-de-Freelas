# Controle de Freelas

An application to manage freelance jobs, track payments, and visualize financial metrics with a calendar-based interface. It includes features for data backup, dashboard analytics with AI insights, and monthly reporting.

---

## 🚀 Getting Started

Follow these instructions to set up and run the project on your local machine for development and testing purposes.

### Prerequisites

Before you begin, ensure you have the following installed on your computer:
- [Node.js](https://nodejs.org/) (version 18 or later)
- npm (which comes bundled with Node.js)

### 1. Installation

First, clone the repository to your local machine and install the necessary dependencies.

```bash
# Clone the repository from GitHub
git clone https://github.com/distadio/Controle-de-Freelas.git

# Navigate into the project directory
cd Controle-de-Freelas

# Install all the project dependencies
npm install
```

### 2. Configuration (API Key)

The application requires a Google API Key to use features like AI Insights (Gemini), Google Drive backups, and Google Calendar sync.

1.  **Create an Environment File:**
    In the root of the `Controle-de-Freelas` folder, create a new file named `.env`.

2.  **Add Your API Key:**
    Open the `.env` file and add the following line, replacing `SUA_CHAVE_API_AQUI` with your actual Google API key.

    ```
    VITE_GOOGLE_API_KEY='SUA_CHAVE_API_AQUI'
    ```

    > **Where to get a key?** You can obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey) or the [Google Cloud Console](https://console.cloud.google.com/apis/credentials). The `.env` file is already listed in `.gitignore`, so your key will remain private and secure on your local machine.

### 3. Running the Application

Once the dependencies are installed and your API key is configured, you can start the local development server.

```bash
# Run the application in development mode
npm run dev
```

After running the command, your terminal will display a local URL, usually **`http://localhost:5173`**. Open this URL in your web browser to see the application running.

Any changes you make to the source code will now automatically reload in the browser.

---

## 🏗️ Building for Production

When you are ready to deploy, you need to create an optimized production build. The deployment script (`deploy.sh`) handles this automatically. However, if you need to do it manually, use the following command:

```bash
npm run build
```

This will create a `dist` folder in your project root, containing all the static files ready for deployment.

## 🚢 Deployment

To deploy your changes to the live server, follow the instructions in the `instructions.md` file. The primary method is using the provided deployment script:

```bash
./deploy.sh
```

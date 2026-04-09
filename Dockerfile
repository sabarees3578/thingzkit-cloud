FROM node:20-bullseye

# Install system dependencies needed for compiling the ESP32 code
RUN apt-get update && apt-get install -y curl python3 python3-pip git wget

# Install arduino-cli
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
RUN mv bin/arduino-cli /usr/local/bin/

# Configure arduino-cli and install esp32 core
RUN arduino-cli core update-index --additional-urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
RUN arduino-cli core install esp32:esp32 --additional-urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json

# Setup the Node.js application
WORKDIR /app
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy application code
COPY . .

# The frontend must be built at runtime on Render because VITE_* environment variables
# are only injected by Render at runtime, not during the Docker image build.
CMD sh -c "npm run build && npm start"

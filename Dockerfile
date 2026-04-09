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

# Define environment variables securely required by the React frontend build
ENV VITE_FIREBASE_API_KEY=AIzaSyBYDbb3I2uMIXPp_h9jqyzXMtAjSnJi7mM
ENV VITE_FIREBASE_AUTH_DOMAIN=enthu-tech.firebaseapp.com
ENV VITE_FIREBASE_PROJECT_ID=enthu-tech
ENV VITE_FIREBASE_STORAGE_BUCKET=enthu-tech.firebasestorage.app
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=947603376082
ENV VITE_FIREBASE_APP_ID=1:947603376082:web:b84ea61b98e54898e62a0b
ENV VITE_FIREBASE_MEASUREMENT_ID=G-QH9Q2PN27B

# Install npm dependencies
RUN npm install

# Copy application code
COPY . .

# The frontend must be built at runtime on Render because VITE_* environment variables
# are only injected by Render at runtime, not during the Docker image build.
CMD sh -c "npm run build && npm start"

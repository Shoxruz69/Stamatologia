FROM node:20-alpine

WORKDIR /app

# Faqat dependency fayllarini nusxalash
COPY package*.json ./
RUN npm install --omit=dev

# Barcha kodlarni nusxalash
COPY . .

# Dist papkasini yaratish (agar yo'q bo'lsa)
RUN mkdir -p dist

EXPOSE 3000

CMD ["node", "serve-web.js"]

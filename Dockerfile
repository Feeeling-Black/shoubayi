FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY ShouBaYiCocos/assets/resources/ui/Hand ./ShouBaYiCocos/assets/resources/ui/Hand
COPY ShouBaYiCocos/assets/resources/ui ./ShouBaYiCocos/assets/resources/ui
COPY ShouBaYiCocos/assets/resources/table-bg-v1.png ./ShouBaYiCocos/assets/resources/table-bg-v1.png
COPY ShouBaYiCocos/assets/resources/table-bg-v1-mobile.jpg ./ShouBaYiCocos/assets/resources/table-bg-v1-mobile.jpg
COPY ShouBaYiCocos/assets/Texture/table-bg-v1.png ./ShouBaYiCocos/assets/Texture/table-bg-v1.png

ENV NODE_ENV=production
ENV PORT=4180

EXPOSE 4180

CMD ["npm", "start"]

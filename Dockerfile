FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY ShouBaYiCocos/assets/resources/ui/Hand ./ShouBaYiCocos/assets/resources/ui/Hand

ENV NODE_ENV=production
ENV PORT=4180

EXPOSE 4180

CMD ["npm", "start"]

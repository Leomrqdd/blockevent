FROM node:22
WORKDIR /app
ENV NODE_ENV production
COPY package*.json ./
COPY . .
RUN yarn install --force
RUN yarn build
CMD [ "yarn", "start" ]


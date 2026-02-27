#!/bin/bash

DOCKER_USER="areynardhes"
IMAGE_NAME="tisc-editor-app"
TAG="latest"

GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}1. Logging into Docker Hub...${NC}"
docker login

echo -e "${GREEN}2. Building the image...${NC}"
docker build --platform linux/amd64 -t $DOCKER_USER/$IMAGE_NAME:$TAG ./app

echo -e "${GREEN}3. Pushing the image to Docker Hub...${NC}"
docker push $DOCKER_USER/$IMAGE_NAME:$TAG

echo -e "${GREEN}Finished!${NC}"
echo "You can now update your server by running:"
echo "docker pull $DOCKER_USER/$IMAGE_NAME:$TAG"
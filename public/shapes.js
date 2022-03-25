const shapeImages = [
  "./images/shape-triangle.svg",
  "./images/shape-circle.svg",
  "./images/shape-magnet.svg",
  "./images/shape-diamond.svg",
  "./images/shape-fish.svg",
  "./images/shape-spiral.svg",
  "./images/shape-threedots.svg",
  "./images/shape-lightning.svg"
];

export function getRandomShapeImage() {
  return shapeImages[Math.floor(Math.random()*shapeImages.length)];
}

export function getShapeImage(index) {
  return shapeImages[index];
}

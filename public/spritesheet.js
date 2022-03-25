export function animateSpritesheet(canvasElement, randomizeStart = false, colorSeed = null) {
  let ctx = canvasElement.getContext("2d");
  let width = 128;
  let height = 128;
  canvasElement.width = width;
  canvasElement.height = height;
  let frameWidth = 128;
  let frameHeight = 128;
  let frameIndex = 0;
  let frameCount = 0;
  let framesPerRow = 0;
  let framesPerSecond = 12;
  let frameTimeMS = 1 / framesPerSecond * 1000;
  let scale = 1;

  // Generate hue
  let hue = Math.floor(Math.random() * 361);
  if (colorSeed != null) {
    hue = generateHue(colorSeed);
  }

  let spritesheet = new Image();
  spritesheet.src = "./images/spritesheet.png";
  spritesheet.onload = function() {
    framesPerRow = this.width / frameWidth;
    frameCount = framesPerRow * (this.height / frameHeight);
    if (randomizeStart) {
      frameIndex = Math.floor(Math.random() * frameCount);
    }
  }
  
  let previousTimestamp = performance.now();
  let elapsed = 0;
  function step(timestamp) {
    elapsed += (timestamp - previousTimestamp);
    previousTimestamp = timestamp;
    
    while (elapsed >= frameTimeMS) {
      elapsed -= frameTimeMS;
      ++frameIndex;
      if (frameIndex >= frameCount) {
        frameIndex = 0;
      }
    }
    
    ctx.clearRect(0, 0, width, height);
    let destWidth = width * scale;
    let destHeight = height * scale;
    let destX = 0;
    let destY = 0;
    // If it has been scaled down, center the sprite on the canvas
    if (scale < 1) {
      destX = (width - destWidth) / 2;
      destY = (height - destHeight) / 2;
    }
    let srcY = Math.floor(frameIndex / framesPerRow) * frameHeight;
    let srcX = (frameIndex % framesPerRow) * frameWidth;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(spritesheet, srcX, srcY, frameWidth, frameHeight,
                               destX, destY, destWidth, destHeight);
    
    // Change to randomized color
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = "hsl(" + hue + ",50%, 50%)";
    ctx.fillRect(0, 0, width, height);
    // Mask out drawn rectangle
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(spritesheet, srcX, srcY, frameWidth, frameHeight,
                               destX, destY, destWidth, destHeight);
    
    window.requestAnimationFrame(step);
  }
  window.requestAnimationFrame(step);
}

export function drawSprite(canvasElement, spriteSrc, colorSeed = null, sWidth = 64, sHeight = 64, dWidth = 64, dHeight = 64) {
  let ctx = canvasElement.getContext("2d");
  canvasElement.width = dWidth;
  canvasElement.height = dHeight;

  // Generate hue
  let hue = Math.floor(Math.random() * 361);
  if (colorSeed != null) {
    hue = generateHue(colorSeed);
  }

  let spritesheet = new Image();
  spritesheet.src = spriteSrc;
  spritesheet.onload = function() {
    ctx.clearRect(0, 0, dWidth, dHeight);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(spritesheet, 0, 0, sWidth, sHeight,
                               0, 0, dWidth, dHeight);
    
    // Change to randomized color
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = "hsl(" + hue + ",50%, 50%)";
    ctx.fillRect(0, 0, dWidth, dHeight);
    // Mask out drawn rectangle
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(spritesheet, 0, 0, sWidth, sHeight,
                              0, 0, dWidth, dHeight);
  }
  
}

function generateHue(colorSeed) {
  let hue = colorSeed.charCodeAt(0);
  for (let i = 1; i < (Math.min(5, colorSeed.length)); ++i) {
    hue *= colorSeed.charCodeAt(i);
  }
  hue %= 361;
  return hue;
}
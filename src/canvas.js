class Canvas {
  static container;

  constructor(id, layer=1) {
    this.id = id;
    this.layer = layer;
    this.mount();
    this.bind();
  }

  bind() {
    Canvas.container.appendChild(this.element);
  }

  mount() {
    const element = document.createElement('CANVAS');
    element.id = `cv-${this.id}`;
    element.classList.add('canvas-layer');
    element.style.zIndex = this.layer;
    this.element = element;
    this.ctx = element.getContext('2d');
  }

  resize(width, height) {
    this.element.width  = width;
    this.element.height = height;
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.element.width, this.element.height);
  }
}

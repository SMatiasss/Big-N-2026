export class CarritoService {
  static getCarrito() {
    const carrito = sessionStorage.getItem('carrito');
    return carrito ? JSON.parse(carrito) : [];
  }

  static guardarCarrito(carrito) {
    sessionStorage.setItem('carrito', JSON.stringify(carrito));
  }

  static actualizarProducto(producto, cantidad) {
    const carrito = this.getCarrito();
    const index = carrito.findIndex(item => item.producto.id === producto.id);

    if (cantidad <= 0) {
      if (index !== -1) carrito.splice(index, 1);
    } else {
      if (index !== -1) {
        carrito[index].cantidad = cantidad;
      } else {
        carrito.push({ producto, cantidad });
      }
    }
    
    this.guardarCarrito(carrito);
    return this.getCarrito();
  }

  static obtenerCantidad(productoId) {
    const carrito = this.getCarrito();
    const item = carrito.find(item => item.producto.id === productoId);
    return item ? item.cantidad : 0;
  }

  static vaciarCarrito() {
    sessionStorage.removeItem('carrito');
  }

  static obtenerTotal() {
    const carrito = this.getCarrito();
    return carrito.reduce((total, item) => total + (item.producto.precio * item.cantidad), 0);
  }
}

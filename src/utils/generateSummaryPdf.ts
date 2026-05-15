import { jsPDF } from 'jspdf';

export const generateSummaryPdf = () => {
  const doc = new jsPDF();
  
  // Set font
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Resumen de Características del Sistema', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  let y = 35;
  const lineHeight = 7;
  
  const addSection = (title: string, items: string[]) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, 20, y);
    y += lineHeight + 2;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    
    items.forEach(item => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const splitText = doc.splitTextToSize(`• ${item}`, 170);
      doc.text(splitText, 25, y);
      y += (splitText.length * lineHeight);
    });
    
    y += 5;
  };

  addSection('1. Punto de Venta (POS)', [
    'Venta Rápida: Búsqueda de productos por nombre o escaneo de código de barras.',
    'Múltiples Métodos de Pago: Soporta Efectivo, Tarjeta, Transferencia, Mercado Pago, CLIP y pagos Mixtos.',
    'Gestión de Cobro: Cálculo automático de cambio y manejo de comisiones bancarias o de terminales (pudiendo asignarlas al cliente o absorberlas el vendedor).',
    'Descuentos: Aplicación de descuentos individuales por artículo en el carrito.',
    'Asignación de Clientes: Permite vincular una venta a un cliente específico del directorio.'
  ]);

  addSection('2. Gestión de Inventario', [
    'Catálogo Detallado: Registro de productos con imagen, categoría, proveedor, código de barras, precio de compra y precio de venta.',
    'Control de Stock: Seguimiento de existencias en tiempo real y configuración de "Stock Mínimo" para alertas.',
    'Historial de Movimientos: Trazabilidad completa de quién, cuándo y por qué se modificó el inventario (entradas, salidas, ajustes manuales y ventas).',
    'Lista de Reposición: Generación automática de listas de compras para productos con bajo stock, agrupadas por proveedor y con opción de exportar a PDF.'
  ]);

  addSection('3. Control de Caja y Flujo de Efectivo', [
    'Apertura y Cierre: Gestión de turnos con registro de fondo de caja inicial.',
    'Movimientos de Caja: Botones de acción rápida para registrar ingresos extra o retiros/gastos (ej. pago de servicios, compra de insumos) sin afectar el inventario.',
    'Desglose Automático: El sistema separa automáticamente cuánto dinero debe haber en efectivo y cuánto ingresó por terminales o transferencias.',
    'Cuadre de Caja: Cálculo automático de diferencias (faltantes o sobrantes) al ingresar el efectivo real durante el cierre.'
  ]);

  addSection('4. Dashboard y Reportes', [
    'Métricas en Tiempo Real: Visualización rápida de ventas del día, de la semana, del mes y cálculo de la ganancia neta (utilidad).',
    'Historial de Ventas: Registro de todos los tickets emitidos. Permite cancelar ventas (lo que restaura automáticamente el stock y ajusta la caja) o recargar ventas al carrito.',
    'Módulo de Reportes: Análisis detallado del rendimiento del negocio.'
  ]);

  addSection('5. Remisiones y Cotizaciones', [
    'Creación de Notas: Módulo independiente para crear remisiones o cotizaciones con folios personalizados.',
    'Artículos Libres: Permite agregar conceptos, cantidades y precios que no necesariamente están en el inventario físico.'
  ]);

  addSection('6. Clientes y Usuarios', [
    'Directorio de Clientes: Base de datos básica (nombre, teléfono, correo) para seguimiento de ventas.',
    'Control de Acceso: Sistema de inicio de sesión mediante un PIN numérico.',
    'Roles y Permisos: Soporta diferentes niveles de usuario (Administrador, Cajero, Supervisor) para proteger información sensible.'
  ]);

  addSection('7. Configuración y Personalización', [
    'Perfil del Negocio: Personalización de tickets con Logo, Nombre Legal, RFC, Dirección, Teléfono y mensaje de agradecimiento.',
    'Impuestos y Moneda: Configuración de tasa de impuestos (ej. IVA) y opción de aplicarlo o no a las ventas.',
    'Interfaz: Soporte nativo para Modo Claro y Modo Oscuro.',
    'Seguridad del Sistema: Protección mediante sistema de licencias ligado al ID del equipo para evitar copias no autorizadas.'
  ]);

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(128, 128, 128);
  doc.text('Generado automáticamente por el Sistema POS', 105, 290, { align: 'center' });

  doc.save('Resumen_Caracteristicas_POS.pdf');
};

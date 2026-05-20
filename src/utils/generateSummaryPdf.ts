import { jsPDF } from 'jspdf';

export const generateSummaryPdf = () => {
  const doc = new jsPDF();
  let pageCount = 1;

  // Primary palette (Dark Slate Gray for headers, Indigo/Blue for subheaders)
  const colors = {
    primary: [30, 41, 59],     // #1e293b
    secondary: [37, 99, 235],  // #2563eb
    muted: [100, 116, 139],    // #64748b
    black: [15, 23, 42]        // #0f172a
  };

  const drawHeader = () => {
    // Top banner background
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.rect(0, 0, 210, 35, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('GUÍA DE OPERACIÓN DEL SISTEMA', 105, 18, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Sistema de Punto de Venta (POS) Inteligente y Control de Inventarios', 105, 26, { align: 'center' });

    // Accent line
    doc.setDrawColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setLineWidth(2);
    doc.line(0, 35, 210, 35);
  };

  const drawFooter = () => {
    doc.setDrawColor(226, 232, 240); // light gray
    doc.setLineWidth(0.5);
    doc.line(15, 280, 195, 280);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    
    // Left side: Name
    doc.text('Manual de Usuario & Operación POS', 15, 287);
    
    // Right side: Page number
    doc.text(`Página ${pageCount}`, 195, 287, { align: 'right' });
  };

  // Setup Initial Page
  drawHeader();
  let y = 50;
  const lineHeight = 7;

  const checkPageBreak = (neededLines: number) => {
    if (y + (neededLines * lineHeight) > 270) {
      drawFooter();
      doc.addPage();
      pageCount++;
      drawHeader();
      y = 52;
    }
  };

  const addDocSection = (title: string, items: string[], intro?: string) => {
    // Calculate total layout space needed
    const totalLinesNeeded = 2 + (intro ? doc.splitTextToSize(intro, 180).length : 0) + items.length * 2.5;
    checkPageBreak(totalLinesNeeded);

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(title, 15, y);
    y += lineHeight + 1;

    // Small highlight accent on the left of section title
    doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.rect(10, y - lineHeight - 4, 2.5, 5, 'F');

    // Section Intro (optional)
    if (intro) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
      const splitIntro = doc.splitTextToSize(intro, 180);
      doc.text(splitIntro, 15, y);
      y += (splitIntro.length * lineHeight) + 2;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);

    items.forEach(item => {
      // Split sub-bullet properly
      const splitText = doc.splitTextToSize(`• ${item}`, 175);
      checkPageBreak(splitText.length);
      doc.text(splitText, 17, y);
      y += (splitText.length * Math.floor(lineHeight * 0.9)) + 2;
    });

    y += 5; // Section space
  };

  // SECTION CONTENT

  addDocSection(
    '1. SEGURIDAD, ROLES Y ACCESO CONTROLANDO EL PERSONAL',
    [
      'Administrador (Control Total): El único usuario con permiso absoluto para dar de alta, modificar o eliminar productos; registrar, editar o eliminar cajeros; ver estadísticas financieras avanzadas (Costo de Productos, Margen, Ganancia Neta), reportes globales y realizar configuraciones del negocio/ticket.',
      'Cajero (Restringido): Un perfil optimizado para transacciones rápidas. No tiene acceso a módulos administrativos ni sensibles. El menú lateral oculta automáticamente las pestañas Seguridad, Proveedores, Remisiones, Reportes Financieros y Configuración general.',
      'Protección de Vistas en el Dashboard: En el Panel de Control (Dashboard), las tarjetas informativas de Ganancia Neta y Costo de Productos se ocultan totalmente para proteger la privacidad financiera. Solo se muestran ventas del día y cantidad de órdenes.',
      'Privacidad de Operación en Caja e Inventario: El Cajero no puede crear nuevos productos, reponer stock o vaciar bases de datos; tampoco puede auditar el historial de movimientos de inventario global ni realizar exportaciones masivas a Excel.',
      'PIN de Identificación Único: Cada usuario selecciona un PIN numérico de acceso rápido para bloquear o cambiar de cuenta en segundos, garantizando auditoría completa de quién realiza cada venta o retiro de dinero.'
    ],
    'Para garantizar la integridad de los datos de su negocio y evitar fugas de información, el sistema implementa un potente control de seguridad basado en roles diferenciados:'
  );

  addDocSection(
    '2. APERTURA, REGISTRO Y CIERRE DE CAJA DIARIA',
    [
      'Apertura Obligatoria: Al ingresar al sistema por primera vez en el día, se solicitará automáticamente registrar un "Monto Inicial de Caja" (Fondo de Cambio). Sin este paso, el POS advertirá que la caja está cerrada.',
      'Control de Movimientos de Emergencia: Desde el panel de "Caja" se permite ingresar o retirar efectivo por conceptos específicos (ej: pago de servicios, compra urgente de insumos locales). Estos movimientos se restan o suman automáticamente al efectivo final esperado.',
      'Diferenciación de Canales de Cobro: El sistema segmenta los flujos. El efectivo físico permanece diferenciado de los cobros digitales (Tarjeta, Transferencia Electrónica, CLIP, Mercado Pago), por lo que un arqueo de caja nunca se mezclará de manera confusa.',
      'Cuadre Automático con Declaración a Ciegas: Al finalizar la jornada, el cajero realiza un "Arqueo de Caja" ingresando la cantidad de efectivo físico real contado en mano. El sistema calcula inmediatamente el saldo esperado vs. real, alertando de posibles faltantes o sobrantes.'
    ],
    'El control de caja es fundamental para auditar su dinero físico día tras día sin complejidades:'
  );

  addDocSection(
    '3. OPERACIÓN DE VENTAS (PUNTO DE VENTA - POS)',
    [
      'Registro Flexible de Artículos: Búsqueda ágil de productos ingresando su nombre, clave, o bien escaneando directamente su código de barras mediante un lector compatible.',
      'Gestión Inteligente de Comisiones: Permite de manera transparente programar si las comisiones de Terminales de Pago o Transferencias son cubiertas/retenidas por el establecimiento, o bien traspasadas directamente al checkout del cliente.',
      'Programa de Puntos y Fidelización de Clientes: Al registrar las compras con clientes específicos, acumulan automáticamente un "monedero de puntos" equivalente al 1% de su ticket. El cajero podrá canjear estos puntos por un descuento equivalente a pesos ($) al momento de cerrar la próxima venta.',
      'Ventas en Espera (Carrito Suspendido): Permite colocar carritos completos con artículos pesados en "Espera", asignando un identificador (ej: Nombre de cliente o número de mesa), liberando el POS para atender a otros clientes en la fila.',
      'Tickets y Registro Fiscal: Emisión de remisiones automatizadas con folios únicos para cotizar o amparar mercancías fuera de tienda, ideal para ventas corporativas o entregas masivas.'
    ],
    'El POS está estructurado con una interfaz dinámica pensada para reducir los tiempos de cobro en caja:'
  );

  addDocSection(
    '4. GESTIÓN INTEGRAL DE INVENTARIOS Y ABASTO',
    [
      'Ficha de Producto de Alta Precisión: Registro de productos asignando imágenes, control de marcas/proveedores, precios de compra mayorista y venta minorista, así como clasificación por sectores para una fácil auditoría.',
      'Alertas de Abastecimiento Automáticas: Al definir el stock mínimo por producto, el sistema genera de forma automática un aviso visual de bajo stock cuando los límites sean sobrepasados.',
      'Módulo de Ajustes y Reposición Rápida (Sugerido para Administrador): Permite auditar qué productos están en niveles bajos de existencias y generar un reporte de cotización listo para mandar a proveedores con un solo clic.',
      'Trazabilidad Integral: El historial de movimientos rastrea automáticamente cada unidad que entra o sale junto con el usuario responsable (Cajero/Administrador) para evitar pérdidas hormiga.',
      'Historial de Garantías: Control completo de pólizas, plazos y números de serie asociados a productos vendidos para facilitar reembolsos o cambios directo de fábrica.'
    ],
    'Herramientas avanzadas para que nunca se quede sin artículos clave en stock:'
  );

  addDocSection(
    '5. CONFIGURACIÓN, RESPALDOS Y ENLACE CLOUD',
    [
      'Enlace Nube Sincronizado (Seguridad): Todo cambio local se sincroniza automáticamente con la base de datos centralizada de Firestore Firebase, garantizando que si el equipo sufre un daño eléctrico, se pueda recuperar la información al instante.',
      'Personalización Total del Ticket de Venta: Registre fácilmente las bases legales de su negocio, dirección fiscal, teléfono, moneda de cobro, política de impuestos (IVA opcional) y un mensaje comercial de agradecimiento para el pie del ticket.',
      'Respaldo de Seguridad Manual: Descargue fácilmente un archivo completo de la base de datos en formato JSON para almacenar una copia sólida en discos duros locales o unidades externas.',
      'Licenciamiento Autónomo: Bloqueo inteligente del sistema mediante autenticación del Host actual y clave de licencia activa para evitar uso malicioso offline de la plataforma en sucursales no autorizadas.'
    ],
    'El centro tecnológico donde configura el ADN de su negocio de manera segura:'
  );

  drawFooter();
  doc.save('Guia_de_Operacion_POS.pdf');
};

import { Sale, BusinessSettings } from "../types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "./format";

export const generateReceiptImage = async (
  sale: Sale,
  settings: BusinessSettings,
): Promise<Blob | null> => {
  const width = 400;
  // We'll calculate height dynamically
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Scale for higher resolution
  const scale = 2;
  
  // Create a temporary canvas context to measure text
  let currentY = 30;
  
  const addText = (text: string, font: string, align: CanvasTextAlign, yOffset: number) => {
    ctx.font = font;
    ctx.textAlign = align;
    currentY += yOffset;
  };

  // Pre-calculate heights
  let totalHeight = 30; // initial padding top

  // 1. Header
  totalHeight += 35; // Title
  if (settings.legalName) totalHeight += 20;
  if (settings.rfc) totalHeight += 20;
  if (settings.address) totalHeight += 20;
  if (settings.phone) totalHeight += 20;

  // 2. Info Box (Ticket, date, etc.)
  totalHeight += 20; // padding top
  totalHeight += 20; // Ticket #
  totalHeight += 20; // Date
  if (sale.customerName) totalHeight += 20;
  if (sale.paymentMethod) totalHeight += 20;
  totalHeight += 10; // padding bottom

  // 3. Items
  totalHeight += 20; // top dashed line gap
  sale.items.forEach(item => {
    totalHeight += 25; // approximate each item
  });
  totalHeight += 20; // bottom dashed line gap

  // 4. Totals
  totalHeight += 25; // Subtotal
  if (sale.tax > 0) totalHeight += 25;
  if (sale.commission && sale.commissionPayer === 'cliente') totalHeight += 25;
  
  // 5. Grand Total (blue box)
  totalHeight += 60; // 

  // 6. Footer
  totalHeight += 40; // padding top + text

  totalHeight += 30; // padding bottom

  // Now set the actual dimensions
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  currentY = 30; // Reset Y

  // Helper to draw text
  const drawText = (text: string, x: number, font: string, color: string, align: CanvasTextAlign) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(text, x, currentY);
  };

  // Header Title
  drawText(settings.name || "EliteCaja", width / 2, "800 26px system-ui, sans-serif", "#1e293b", "center");
  currentY += 32;

  // Header Details
  if (settings.legalName) {
    drawText(settings.legalName, width / 2, "14px system-ui, sans-serif", "#475569", "center");
    currentY += 20;
  }
  if (settings.rfc) {
    drawText(`RFC: ${settings.rfc}`, width / 2, "14px system-ui, sans-serif", "#475569", "center");
    currentY += 20;
  }
  if (settings.address) {
    drawText(settings.address, width / 2, "14px system-ui, sans-serif", "#475569", "center");
    currentY += 20;
  }
  if (settings.phone) {
    drawText(`Tel: ${settings.phone}`, width / 2, "14px system-ui, sans-serif", "#475569", "center");
    currentY += 20;
  }

  currentY += 10;

  // Info Box
  const boxPadding = 10;
  ctx.fillStyle = "#f1f5f9";
  
  // Calculate height of info box based on contents
  let infoBoxLines = 2; // Ticket + Date
  if (sale.customerName) infoBoxLines++;
  if (sale.paymentMethod) infoBoxLines++;
  const boxHeight = (infoBoxLines * 20) + (boxPadding * 2);

  ctx.beginPath();
  ctx.roundRect(15, currentY, width - 30, boxHeight, 8);
  ctx.fill();

  currentY += boxPadding;
  
  // Info Box Text - Left
  let leftY = currentY;
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "left";
  ctx.fillText(`Ticket: #${sale.id}`, 25, leftY);
  leftY += 20;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(format(new Date(sale.date), "dd/MM/yyyy HH:mm", { locale: es }), 25, leftY);

  // Info Box Text - Right
  let rightY = currentY;
  ctx.textAlign = "right";
  if (sale.customerName) {
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("Cliente: ", width - 25 - ctx.measureText(sale.customerName).width, rightY);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(sale.customerName, width - 25, rightY);
    rightY += 20;
  }
  if (sale.paymentMethod) {
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`Pago: ${sale.paymentMethod}`, width - 25, rightY);
  }

  currentY += boxHeight;
  currentY += 15;

  // Dashed line
  const drawDashedLine = (y: number) => {
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(15, y);
    ctx.lineTo(width - 15, y);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashedLine(currentY);
  currentY += 15;

  // Items
  ctx.font = "14px monospace";
  ctx.fillStyle = "#0f172a";
  sale.items.forEach(item => {
    let price = item.salePrice;
    const discountAmount = item.discount > 0 ? price * (item.discount / 100) : 0;
    const finalPrice = price - discountAmount;
    const total = finalPrice * item.quantity;
    
    ctx.textAlign = "left";
    ctx.fillText(`${item.quantity}x ${item.name}`, 15, currentY);
    
    const formattedTotal = formatCurrency(total, settings.currency);
    ctx.textAlign = "right";
    ctx.font = "bold 14px monospace";
    ctx.fillText(formattedTotal, width - 15, currentY);
    ctx.font = "14px monospace"; // reset

    currentY += 25;
  });

  currentY += 5;
  drawDashedLine(currentY);
  currentY += 15;

  // Sums
  const drawRow = (label: string, value: string, isBold = false) => {
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText(label, 15, currentY);
    
    ctx.font = (isBold ? "bold " : "") + "14px system-ui, sans-serif";
    ctx.fillStyle = "#334155";
    ctx.textAlign = "right";
    ctx.fillText(value, width - 15, currentY);
    currentY += 25;
  };

  drawRow("Subtotal:", formatCurrency(sale.subtotal, settings.currency), true);
  if (sale.tax > 0) {
    drawRow(`IVA (${settings.taxRate}%):`, formatCurrency(sale.tax, settings.currency), true);
  }
  if (sale.commission && sale.commissionPayer === "cliente") {
    drawRow(`Comisión ${sale.paymentMethod}:`, formatCurrency(sale.commission, settings.currency), true);
  }

  currentY += 10;

  // Grand Total Box
  const totalBoxHeight = 50;
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.roundRect(15, currentY, width - 30, totalBoxHeight, 8);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "900 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("TOTAL:", 30, currentY + 12);
  
  ctx.textAlign = "right";
  ctx.fillText(formatCurrency(sale.total, settings.currency), width - 30, currentY + 12);

  currentY += totalBoxHeight;
  currentY += 25;

  // Footer Message
  drawText(settings.receiptMessage || "¡Gracias por su compra!", width / 2, "italic 13px system-ui, sans-serif", "#64748b", "center");

  // Generate Blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
  });
};

export const shareReceiptWhatsApp = async (
  sale: Sale,
  settings: BusinessSettings,
  phone?: string,
  name?: string,
) => {
  const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
  const customerName = name || "Cliente";
  const message = `Hola ${customerName}, enviamos el comprobante de tu compra (Ticket #${sale.id}) por un total de ${formatCurrency(sale.total, settings.currency)}. ¡Gracias por tu preferencia!`;

  // Check if we can share natively (usually on mobile apps)
  const canNativeShare = navigator.share && navigator.canShare;
  
  // Try Web Share API first if supported
  if (canNativeShare) {
    const blob = await generateReceiptImage(sale, settings);
    if (blob) {
      const file = new File([blob], `Ticket_${sale.id}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Ticket #${sale.id}`,
            text: message,
            files: [file],
          });
          return;
        } catch (e) {
          console.log("Native share failed", e);
        }
      }
    }
  }

  // Fallback for Desktop/Web or if Native share failed.
  // Generate blob for direct download
  const blob = await generateReceiptImage(sale, settings);
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ticket_${sale.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } else {
    console.error("Could not generate receipt image for fallback WhatsApp share");
  }

  // Open WhatsApp Web
  const waUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  window.open(waUrl, "_blank");
};

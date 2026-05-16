import { toBlob } from "html-to-image";
import { Sale, BusinessSettings } from "../types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCurrency } from "./format";

export const generateReceiptImage = async (
  sale: Sale,
  settings: BusinessSettings,
): Promise<Blob | null> => {
  const div = document.createElement("div");
  div.style.position = "absolute";
  div.style.left = "-9999px";
  div.style.top = "-9999px";
  div.style.width = "400px";
  div.style.backgroundColor = "white";
  div.style.padding = "30px";
  div.style.color = "black";
  div.style.fontFamily = "monospace";
  div.style.lineHeight = "1.4";

  // Build HTML string
  let itemsHtml = sale.items
    .map((item) => {
      let price = item.salePrice;
      const discountAmount =
        item.discount > 0 ? price * (item.discount / 100) : 0;
      const finalPrice = price - discountAmount;
      const total = finalPrice * item.quantity;
      return `
       <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
         <div style="max-width: 65%; word-break: break-all;">${item.quantity}x ${item.name}</div>
         <div style="font-weight: bold;">${formatCurrency(total, settings.currency)}</div>
       </div>
     `;
    })
    .join("");

  div.innerHTML = `
    <div style="text-align: center; margin-bottom: 25px;">
      <h2 style="margin: 0; font-size: 26px; font-family: system-ui, -apple-system, sans-serif; font-weight: 800; color: #1e293b;">${settings.name || "EliteCaja"}</h2>
      ${settings.legalName ? `<div style="font-family: system-ui, -apple-system, sans-serif; color: #475569; margin-top: 4px;">${settings.legalName}</div>` : ""}
      ${settings.rfc ? `<div style="font-family: system-ui, -apple-system, sans-serif; color: #475569;">RFC: ${settings.rfc}</div>` : ""}
      ${settings.address ? `<div style="font-family: system-ui, -apple-system, sans-serif; color: #475569;">${settings.address}</div>` : ""}
      ${settings.phone ? `<div style="font-family: system-ui, -apple-system, sans-serif; color: #475569;">Tel: ${settings.phone}</div>` : ""}
    </div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #334155; background: #f1f5f9; padding: 10px; border-radius: 8px;">
      <div>
        <div style="font-weight: bold; color: #0f172a;">Ticket: #${sale.id}</div>
        <div>${format(new Date(sale.date), "dd/MM/yyyy HH:mm", { locale: es })}</div>
      </div>
      <div style="text-align: right;">
        ${sale.customerName ? `<div>Cliente: <span style="font-weight: 600;">${sale.customerName}</span></div>` : ""}
        ${sale.paymentMethod ? `<div>Pago: ${sale.paymentMethod}</div>` : ""}
      </div>
    </div>
    <div style="border-top: 2px dashed #cbd5e1; border-bottom: 2px dashed #cbd5e1; padding: 15px 0; margin-bottom: 20px;">
      ${itemsHtml}
    </div>
    <div style="display: flex; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; margin-bottom: 8px;">
      <div style="color: #64748b;">Subtotal:</div>
      <div style="font-weight: bold; color: #334155;">${formatCurrency(sale.subtotal, settings.currency)}</div>
    </div>
    ${
      sale.tax > 0
        ? `
    <div style="display: flex; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; margin-bottom: 8px;">
      <div style="color: #64748b;">IVA (${settings.taxRate}%):</div>
      <div style="font-weight: bold; color: #334155;">${formatCurrency(sale.tax, settings.currency)}</div>
    </div>`
        : ""
    }
    ${
      sale.commission && sale.commissionPayer === "cliente"
        ? `
    <div style="display: flex; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; margin-bottom: 8px;">
      <div style="color: #64748b;">Comisión ${sale.paymentMethod}:</div>
      <div style="font-weight: bold; color: #334155;">${formatCurrency(sale.commission, settings.currency)}</div>
    </div>`
        : ""
    }
    <div style="display: flex; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; font-weight: 900; font-size: 22px; margin-top: 15px; background: #3b82f6; color: white; padding: 12px; border-radius: 8px;">
      <div>TOTAL:</div>
      <div>${formatCurrency(sale.total, settings.currency)}</div>
    </div>
    <div style="text-align: center; margin-top: 30px; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #64748b; font-style: italic;">
      ${settings.receiptMessage || "¡Gracias por su compra!"}
    </div>
  `;

  document.body.appendChild(div);

  try {
    const blob = await toBlob(div, { backgroundColor: '#ffffff', pixelRatio: 2 });
    document.body.removeChild(div);
    if (!blob) {
      throw new Error("No se pudo generar el contenido del ticket");
    }
    return blob;
  } catch (e: any) {
    console.error("Error generating image", e);
    // If image generation fails, don't alert, just return null so it falls back nicely.
    if (document.body.contains(div)) {
      document.body.removeChild(div);
    }
    return null;
  }
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

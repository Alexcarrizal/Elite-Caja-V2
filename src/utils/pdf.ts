import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, BusinessSettings } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from './format';

export const generateReceiptPDF = (sale: Sale, settings: BusinessSettings) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const halfHeight = pageHeight / 2;

  // Draw cut line
  doc.setLineDashPattern([5, 5], 0);
  doc.setLineWidth(0.5);
  doc.setDrawColor(150, 150, 150);
  doc.line(10, halfHeight, pageWidth - 10, halfHeight);
  doc.setLineDashPattern([], 0); // Reset

  // Add scissors icon or text
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('✂--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------', 10, halfHeight + 1);

  const drawReceipt = (startY: number, title: string) => {
    let yPos = startY + 15;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Header Background
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');

    // Logo
    let logoX = margin + 5;
    // EliteCaja is permanently the logo and isn't a bitmapped graphic


    // Business Info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.name || 'EliteCaja', logoX, yPos + 12);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    let infoY = yPos + 18;
    if (settings.legalName) { doc.text(settings.legalName, logoX, infoY); infoY += 4; }
    if (settings.rfc) { doc.text(`RFC: ${settings.rfc}`, logoX, infoY); infoY += 4; }
    if (settings.address) { doc.text(settings.address, logoX, infoY); infoY += 4; }
    if (settings.phone) { doc.text(`Tel: ${settings.phone}`, logoX, infoY); }

    // Receipt Title & Info (Right aligned)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('NOTA DE REMISIÓN', pageWidth - margin - 5, yPos + 12, { align: 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(59, 130, 246); // Blue
    doc.text(title, pageWidth - margin - 5, yPos + 18, { align: 'right' });

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(`Folio: #${sale.id}`, pageWidth - margin - 5, yPos + 24, { align: 'right' });
    doc.text(`Fecha: ${format(new Date(sale.date), 'dd/MM/yyyy HH:mm', { locale: es })}`, pageWidth - margin - 5, yPos + 29, { align: 'right' });
    if (sale.customerName) {
      doc.text(`Cliente: ${sale.customerName}`, pageWidth - margin - 5, yPos + 34, { align: 'right' });
    }

    yPos += 45;

    // Items Table
    const tableData = sale.items.map(item => {
      const price = item.salePrice;
      const discountAmount = item.discount > 0 ? price * (item.discount / 100) : 0;
      const finalPrice = price - discountAmount;
      const total = finalPrice * item.quantity;
      
      let description = item.name;
      if (item.barcode) description += `\nCódigo: ${item.barcode}`;
      if (item.warranty) description += `\nGarantía: ${item.warranty}`;
      
      return [
        item.quantity.toString(),
        description,
        formatCurrency(finalPrice, settings.currency),
        formatCurrency(total, settings.currency)
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Cant.', 'Descripción', 'Precio Unit.', 'Importe']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: margin, right: margin }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Totals Box
    const totalsX = pageWidth - margin - 60;
    
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Subtotal:', totalsX, yPos);
    doc.text(formatCurrency(sale.subtotal, settings.currency), pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;

    if (sale.tax > 0) {
      doc.text(`IVA (${settings.taxRate}%):`, totalsX, yPos);
      doc.text(formatCurrency(sale.tax, settings.currency), pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;
    }

    if (sale.commission && sale.commissionPayer === 'cliente') {
      doc.text(`Comisión ${sale.paymentMethod}:`, totalsX, yPos);
      doc.text(formatCurrency(sale.commission, settings.currency), pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;
    }

    // Total Background
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(totalsX - 5, yPos - 4, 65 + 5, 10, 2, 2, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL:', totalsX, yPos + 3);
    doc.text(formatCurrency(sale.total, settings.currency), pageWidth - margin - 2, yPos + 3, { align: 'right' });

    // Footer
    yPos += 15;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    if (settings.receiptMessage) {
      const textWidth = doc.getStringUnitWidth(settings.receiptMessage) * 8 / doc.internal.scaleFactor;
      doc.text(settings.receiptMessage, (pageWidth - textWidth) / 2, yPos);
      yPos += 4;
    }
  };

  drawReceipt(0, 'COPIA CLIENTE');
  drawReceipt(halfHeight, 'COPIA VENDEDOR');

  doc.save(`Nota_Remision_${sale.id}.pdf`);
};

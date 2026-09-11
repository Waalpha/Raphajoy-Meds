import { Sale, BusinessConfig } from '../types';
import { formatCurrency } from '../lib/utils';

// ESC/POS Command Constants
const ESC = '\x1b';
const GS = '\x1d';

const CMD_INIT = ESC + '@';
const CMD_ALIGN_LEFT = ESC + 'a' + '\x00';
const CMD_ALIGN_CENTER = ESC + 'a' + '\x01';
const CMD_ALIGN_RIGHT = ESC + 'a' + '\x02';
const CMD_BOLD_ON = ESC + 'E' + '\x01';
const CMD_BOLD_OFF = ESC + 'E' + '\x00';
const CMD_CUT = GS + 'V' + '\x41' + '\x00'; // Full cut with feed

export class EscPosFormatter {
  private buffer: number[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.buffer = [];
    this.addString(CMD_INIT);
  }

  public addString(str: string): void {
    for (let i = 0; i < str.length; i++) {
      this.buffer.push(str.charCodeAt(i));
    }
  }

  public addLine(text = ''): void {
    this.addString(text + '\n');
  }

  public setAlignment(align: 'left' | 'center' | 'right'): void {
    if (align === 'left') this.addString(CMD_ALIGN_LEFT);
    else if (align === 'center') this.addString(CMD_ALIGN_CENTER);
    else if (align === 'right') this.addString(CMD_ALIGN_RIGHT);
  }

  public setBold(bold: boolean): void {
    if (bold) this.addString(CMD_BOLD_ON);
    else this.addString(CMD_BOLD_OFF);
  }

  public addSeparator(char = '-'): void {
    this.addLine(char.repeat(32)); // 32 chars width for 58mm thermal paper
  }

  public cut(): void {
    this.addString('\n\n\n');
    this.addString(CMD_CUT);
  }

  public getData(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  public static formatSaleReceipt(sale: Sale, businessConfig?: BusinessConfig | null): Uint8Array {
    const formatter = new EscPosFormatter();
    const currency = businessConfig?.currency || 'KSh';
    const businessName = businessConfig?.name || 'KIMUCHU FOOD COURT';
    const address = businessConfig?.address || 'Nairobi CBD';
    const phone = businessConfig?.phone || '+254 712 345 678';
    const footer = businessConfig?.receiptFooter || 'Thank you! Please drink responsibly.';

    // Header
    formatter.setAlignment('center');
    formatter.setBold(true);
    formatter.addLine(businessName.toUpperCase());
    formatter.setBold(false);
    formatter.addLine(address);
    formatter.addLine(`Tel: ${phone}`);
    if (businessConfig?.tillNumber) {
      formatter.setBold(true);
      formatter.addLine(`TILL / PAYBILL: ${businessConfig.tillNumber}`);
      formatter.setBold(false);
    }
    formatter.addSeparator('=');

    // Meta
    formatter.setAlignment('left');
    formatter.addLine(`Receipt #: ${sale.id.slice(-8).toUpperCase()}`);
    formatter.addLine(`Date:     ${sale.date} ${sale.time}`);
    formatter.addLine(`Cashier:  ${sale.cashierName}`);
    formatter.addLine(`Payment:  ${sale.paymentMethod}`);
    if (sale.referenceCode) {
      formatter.addLine(`Ref Code: ${sale.referenceCode}`);
    }
    formatter.addSeparator('-');

    // Items Header
    formatter.addLine('ITEM             QTY  PRICE  TOTAL');
    formatter.addSeparator('-');

    // Items
    sale.items.forEach((item) => {
      const name = item.productName.padEnd(16).slice(0, 16);
      const qty = String(item.quantity).padStart(3);
      const price = String(item.unitPrice).padStart(6);
      const total = String(item.totalAmount).padStart(6);
      formatter.addLine(`${name} ${qty} ${price} ${total}`);
    });

    formatter.addSeparator('-');

    // Totals
    formatter.setAlignment('right');
    formatter.setBold(true);
    formatter.addLine(`TOTAL: ${formatCurrency(sale.totalAmount, currency)}`);
    formatter.setBold(false);

    if (sale.amountTendered !== undefined && sale.amountTendered > 0) {
      formatter.addLine(`Tendered: ${formatCurrency(sale.amountTendered, currency)}`);
    }
    if (sale.change !== undefined && sale.change > 0) {
      formatter.addLine(`Change:   ${formatCurrency(sale.change, currency)}`);
    }

    formatter.addSeparator('=');
    formatter.setAlignment('center');
    formatter.addLine(footer);
    formatter.addLine(`Printed: ${new Date().toLocaleTimeString()}`);

    formatter.cut();
    return formatter.getData();
  }

  public static formatTestReceipt(businessConfig?: BusinessConfig | null): Uint8Array {
    const formatter = new EscPosFormatter();
    const businessName = businessConfig?.name || 'KIMUCHU FOOD COURT';

    formatter.setAlignment('center');
    formatter.setBold(true);
    formatter.addLine('*** USB/BLUETOOTH TEST ***');
    formatter.addLine(businessName.toUpperCase());
    formatter.setBold(false);
    formatter.addSeparator('=');
    formatter.setAlignment('left');
    formatter.addLine('Printer connected successfully!');
    formatter.addLine(`Time: ${new Date().toLocaleString()}`);
    formatter.addLine('58mm Thermal ESC/POS Driver OK.');
    formatter.addSeparator('=');
    formatter.setAlignment('center');
    formatter.addLine('Ready for POS Sales!');
    formatter.cut();
    return formatter.getData();
  }
}

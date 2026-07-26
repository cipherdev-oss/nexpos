import React from 'react';
import { formatCurrency } from './UI';
import { ProductVariant } from '../lib/firebase';

interface ReceiptItem {
  id: string;
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
  total: number;
}

interface ThermalReceiptProps {
  org: any;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  discountAmount?: number;
  couponUsed?: string;
  total: number;
  paymentMethod: 'cash' | 'terminal';
  cashTendered?: number;
  changeDue?: number;
  receiptId: string;
  timestamp: any;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  org,
  items,
  subtotal,
  tax,
  discountAmount = 0,
  couponUsed,
  total,
  paymentMethod,
  cashTendered,
  changeDue,
  receiptId,
  timestamp
}) => {
  const dateStr = timestamp?.toDate ? timestamp.toDate().toLocaleString() : new Date().toLocaleString();

  return (
    <div className="thermal-receipt-container bg-white text-black p-4 font-mono text-[12px] leading-tight w-[80mm] mx-auto print:m-0 print:w-full">
      {/* Header */}
      <div className="text-center mb-4 space-y-1">
        <h1 className="text-lg font-black uppercase tracking-tighter">{org?.name || 'STORE RECEIPT'}</h1>
        <p className="text-[10px]">{org?.address || 'Operational Terminal'}</p>
        <p className="text-[10px]">Tel: {org?.phone || '---'}</p>
      </div>

      <div className="border-b border-black border-dashed my-2"></div>

      {/* Info */}
      <div className="flex justify-between text-[10px] mb-2">
        <span>ID: {receiptId.slice(-8).toUpperCase()}</span>
        <span>{dateStr}</span>
      </div>

      <div className="border-b border-black border-dashed mb-2"></div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        <div className="grid grid-cols-12 font-bold border-b border-black pb-1 mb-1">
          <span className="col-span-6">ITEM</span>
          <span className="col-span-2 text-center">QTY</span>
          <span className="col-span-4 text-right">TOTAL</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 items-start">
            <div className="col-span-6 pr-1">
              <p className="font-bold uppercase leading-none">{item.name}</p>
              {item.variantName && <p className="text-[9px] italic">{item.variantName}</p>}
            </div>
            <span className="col-span-2 text-center">{item.quantity}</span>
            <span className="col-span-4 text-right">{formatCurrency(item.total, org?.currency)}</span>
          </div>
        ))}
      </div>

      <div className="border-b border-black border-dashed my-2"></div>

      {/* Summary */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>SUBTOTAL</span>
          <span>{formatCurrency(subtotal, org?.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>TAX ({org?.baseTax || 0}%)</span>
          <span>{formatCurrency(tax, org?.currency)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between italic">
            <span>DISCOUNT {couponUsed ? `(${couponUsed})` : ''}</span>
            <span>-{formatCurrency(discountAmount, org?.currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black border-t border-black pt-1 mt-1">
          <span>TOTAL</span>
          <span>{formatCurrency(total, org?.currency)}</span>
        </div>
      </div>

      <div className="border-b border-black border-dashed my-3"></div>

      {/* Tender */}
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between uppercase">
          <span>Payment Mode:</span>
          <span className="font-bold">{paymentMethod}</span>
        </div>
        {paymentMethod === 'cash' && (
          <>
            <div className="flex justify-between">
              <span>Cash Tendered:</span>
              <span>{formatCurrency(cashTendered || 0, org?.currency)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Change Due:</span>
              <span>{formatCurrency(changeDue || 0, org?.currency)}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 text-center space-y-2">
        <div className="border-t border-black border-dashed pt-4">
          <p className="text-[10px] font-bold uppercase">Thank you for your business!</p>
          <p className="text-[9px] mt-1">Please come again.</p>
        </div>
        
        {/* Barcode placeholder for thermal scanners */}
        <div className="pt-2">
           <div className="h-8 bg-black w-full mb-1 opacity-20"></div>
           <p className="text-[8px] tracking-[0.5em]">{receiptId.toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
};

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { db, DEFAULT_BUSINESS_ID } from "./firebase";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { AuditLog } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currencyCode: string = 'KSh'): string {
  return `${currencyCode} ${amount.toLocaleString()}`;
}

export async function logAuditAction(
  userId: string,
  userName: string,
  action: string,
  description: string,
  recordId?: string
) {
  const now = new Date();
  const logEntry: Omit<AuditLog, 'id'> = {
    userId,
    userName,
    action,
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().split(' ')[0],
    recordId: recordId || '',
    description,
    createdAt: now.getTime()
  };

  try {
    const auditColRef = collection(db, 'businesses', DEFAULT_BUSINESS_ID, 'auditLogs');
    await addDoc(auditColRef, logEntry);
  } catch (err) {
    // Gracefully catch and store locally if permission denied or offline
    try {
      const localLogs = JSON.parse(localStorage.getItem('bar_pos_audit_logs') || '[]');
      localLogs.unshift({
        id: 'log-' + Date.now(),
        ...logEntry
      });
      localStorage.setItem('bar_pos_audit_logs', JSON.stringify(localLogs.slice(0, 100)));
    } catch (e) {}
  }
}

import { DuePartyType, DueStatus, Expense, Due } from '@amader/db';

export class ExpenseDto {
  id!: number;
  expenseDate!: Date;
  category!: string;
  amount!: string;
  isVatInput!: boolean;
  note!: string | null;
  createdAt!: Date;
}

export function toExpenseDto(row: Expense): ExpenseDto {
  return {
    id: row.id,
    expenseDate: row.expenseDate,
    category: row.category,
    amount: row.amount.toString(),
    isVatInput: row.isVatInput,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export class DueDto {
  id!: number;
  partyType!: DuePartyType;
  partyName!: string;
  customerId!: number | null;
  amount!: string;
  paidAmount!: string;
  remaining!: string;
  status!: DueStatus;
  dueDate!: Date | null;
  note!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toDueDto(row: Due): DueDto {
  return {
    id: row.id,
    partyType: row.partyType,
    partyName: row.partyName,
    customerId: row.customerId,
    amount: row.amount.toString(),
    paidAmount: row.paidAmount.toString(),
    remaining: row.amount.minus(row.paidAmount).toString(),
    status: row.status,
    dueDate: row.dueDate,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

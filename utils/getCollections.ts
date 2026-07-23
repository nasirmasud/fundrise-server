import { type Collection, type ObjectId } from "mongodb";
import { getDb } from "../config/db.js";

export function getCollections() {
  const db = getDb();

  return {
    users: db.collection<User>("users"),
    campaigns: db.collection<Campaign>("campaigns"),
    contributions: db.collection<Contribution>("contributions"),
    notifications: db.collection<Notification>("notifications"),
    transactions: db.collection<Transaction>("transactions"),
    withdrawalRequests: db.collection<WithdrawalRequest>("withdrawalRequests"),
    reports: db.collection<Report>("reports"),
  };
}

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  photoURL?: string;
  password?: string;
  role: "creator" | "supporter" | "admin";
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  _id?: ObjectId;
  creatorEmail: string;
  creatorName: string;
  title: string;
  story: string;
  category: string;
  fundingGoal: number;
  minContribution: number;
  deadline: Date;
  rewardInfo?: string;
  imageURL?: string;
  raisedAmount: number;
  status: "pending" | "approved" | "rejected" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

export interface Contribution {
  _id?: ObjectId;
  campaignId: string;
  campaignTitle: string;
  amount: number;
  supporterEmail: string;
  supporterName: string;
  creatorEmail: string;
  creatorName: string;
  status: "pending" | "approved" | "rejected";
  date: Date;
}

export interface Notification {
  _id?: ObjectId;
  message: string;
  toEmail: string;
  actionRoute: string;
  time: Date;
  read: boolean;
}

export interface Transaction {
  _id?: ObjectId;
  email: string;
  type: "purchase" | "withdrawal" | "credit_added" | "credit_deducted";
  credits?: number;
  amount: number;
  transactionId?: string;
  description: string;
  createdAt: Date;
}

export interface WithdrawalRequest {
  _id?: ObjectId;
  creatorEmail: string;
  amount: number;
  paymentSystem: string;
  accountNumber: string;
  status: "pending" | "paid" | "rejected";
  createdAt: Date;
}

export interface Report {
  _id?: ObjectId;
  reporterName: string;
  reporterEmail: string;
  campaignId: string;
  campaignTitle: string;
  reason: string;
  date: Date;
  status: "pending" | "resolved" | "dismissed";
}

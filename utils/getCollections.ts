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
  supporterEmail: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

export interface Notification {
  _id?: ObjectId;
  email: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Transaction {
  _id?: ObjectId;
  email: string;
  type: "purchase" | "withdrawal" | "credit_added" | "credit_deducted";
  amount: number;
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

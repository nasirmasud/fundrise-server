export function grantStartingCredits(role: "creator" | "supporter"): number {
  return role === "creator" ? 20 : 50;
}
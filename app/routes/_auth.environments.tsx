import { redirect } from "react-router";

export function loader() {
  throw redirect("/tasks");
}

export default function DashboardRedirect() {
  return null;
}

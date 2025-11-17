import { redirect } from "next/navigation";

export default function Page() {
  // Redirect root to the standalone widget route
  redirect("/widget");
}

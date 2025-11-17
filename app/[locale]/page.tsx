import { redirect } from "next/navigation";

export default function LocalePage() {
  // Redirect locale root pages to the standalone widget
  redirect("/widget");
}

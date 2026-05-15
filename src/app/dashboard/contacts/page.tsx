import { redirect } from "next/navigation";

// /dashboard/contacts was renamed to /dashboard/network. Keep this as a
// redirect so existing bookmarks and the old in-page links don't 404.
export default function ContactsRedirect() {
  redirect("/dashboard/network");
}

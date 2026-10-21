"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function text(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: text(formData, "email"),
    password: text(formData, "password")
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export async function signUp(formData: FormData) {
  const password = text(formData, "password");
  if (password.length < 10) {
    redirect(`/login?error=${encodeURIComponent("Use a password with at least 10 characters.")}`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: text(formData, "email"), password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (!data.session) {
    redirect(`/login?msg=${encodeURIComponent("Check your email to confirm your address, then sign in.")}`);
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

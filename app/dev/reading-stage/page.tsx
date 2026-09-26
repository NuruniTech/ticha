import { Suspense } from "react";
import { notFound } from "next/navigation";
import Preview from "./Preview";

// DEV ONLY: renders the reading screen with sample data so its layout can be checked
// at tablet and phone sizes without running a live lesson. 404 outside development.
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense><Preview /></Suspense>;
}

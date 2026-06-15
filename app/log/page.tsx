import { getRatings } from "../api/_lib/store.js";
import LogClient from "./LogClient";

export const dynamic = "force-dynamic";

export default async function LogPage() {
    const ratings = await getRatings();
    return <LogClient ratings={ratings} />;
}

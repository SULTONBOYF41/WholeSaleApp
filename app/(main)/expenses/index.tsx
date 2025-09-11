// app/(main)/expenses/index.tsx
import { Redirect } from "expo-router";
export default function Index() {
    return <Redirect href="/(main)/expenses/report" />;
}

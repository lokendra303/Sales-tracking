import { Redirect, Tabs } from "expo-router";
import { AppTabBar } from "@/components/tab-bar";
import { useAuth } from "@/lib/auth";
import { isAdmin, isManager, isOffice, isSales } from "@/lib/roles";

export default function TabLayout() {
  const { ready, user } = useAuth();

  if (!ready) {
    return null;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }

  const sales = isSales(user.roles);
  const office = isOffice(user.roles);
  const admin = isAdmin(user.roles);
  const manager = isManager(user.roles);

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen
        name="team"
        options={{
          href: office ? "/team" : null,
          title: admin ? "Managers" : "Team",
          tabBarShowLabel: office,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          href: admin ? null : "/leads",
          title: "Leads",
          tabBarShowLabel: !admin,
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          href: sales || manager ? "/visits" : null,
          title: manager ? "Proof" : "Visits",
          tabBarShowLabel: sales || manager,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: manager || sales ? "/reports" : null,
          title: "Reports",
          tabBarShowLabel: manager || sales,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: admin ? "/settings" : null,
          title: "Settings",
          tabBarShowLabel: admin,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: office ? "Profile" : "More",
        }}
      />
    </Tabs>
  );
}
